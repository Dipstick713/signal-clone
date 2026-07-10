"""Real-time WebSocket endpoint.

Clients connect to `/ws?token=<jwt>`. The socket carries a small JSON event
protocol covering messaging, delivery/read receipts, typing indicators, and
presence.

    client → server
      { "type": "message.send", "conversation_id", "body", "temp_id"?, "reply_to_id"? }
      { "type": "receipt.delivered", "conversation_id", "message_id" }
      { "type": "receipt.read", "conversation_id", "message_id" }
      { "type": "typing.start" | "typing.stop", "conversation_id" }

    server → client
      { "type": "message.new", "temp_id"?, "message": {...} }
      { "type": "receipt.update", "conversation_id", "user_id", "kind", "message_id" }
      { "type": "typing.update", "conversation_id", "user_id", "is_typing" }
      { "type": "presence.update", "user_id", "is_online", "last_seen" }
      { "type": "presence.snapshot", "user_ids": [...] }   // online contacts, on connect
      { "type": "error", "detail": "..." }
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.conversation import MessagePublic
from app.services.messages import (
    advance_delivered,
    advance_read,
    create_message,
    is_participant,
    participant_ids,
)
from app.services.presence import contacts_of
from app.ws.manager import manager

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------- #
# Event handlers
# --------------------------------------------------------------------------- #
async def _handle_message_send(user_id: int, data: dict) -> None:
    conversation_id = data.get("conversation_id")
    body = (data.get("body") or "").strip()
    temp_id = data.get("temp_id")
    reply_to_id = data.get("reply_to_id")

    if not isinstance(conversation_id, int) or not body:
        return

    db = SessionLocal()
    try:
        if not is_participant(db, conversation_id, user_id):
            await manager.send_to_users(
                {user_id}, {"type": "error", "detail": "Not a participant"}
            )
            return
        msg = create_message(db, conversation_id, user_id, body, reply_to_id)
        payload = {
            "type": "message.new",
            "temp_id": temp_id,
            "message": MessagePublic.model_validate(msg).model_dump(mode="json"),
        }
        recipients = participant_ids(db, conversation_id)
    finally:
        db.close()

    await manager.send_to_users(recipients, payload)


async def _handle_receipt(user_id: int, data: dict, kind: str) -> None:
    conversation_id = data.get("conversation_id")
    message_id = data.get("message_id")
    if not isinstance(conversation_id, int) or not isinstance(message_id, int):
        return

    db = SessionLocal()
    try:
        advance = advance_delivered if kind == "delivered" else advance_read
        new_watermark = advance(db, conversation_id, user_id, message_id)
        if new_watermark is None:
            return
        recipients = participant_ids(db, conversation_id)
    finally:
        db.close()

    await manager.send_to_users(
        recipients,
        {
            "type": "receipt.update",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "kind": kind,
            "message_id": new_watermark,
        },
    )


async def _handle_typing(user_id: int, data: dict, is_typing: bool) -> None:
    conversation_id = data.get("conversation_id")
    if not isinstance(conversation_id, int):
        return

    db = SessionLocal()
    try:
        if not is_participant(db, conversation_id, user_id):
            return
        recipients = participant_ids(db, conversation_id) - {user_id}
    finally:
        db.close()

    await manager.send_to_users(
        recipients,
        {
            "type": "typing.update",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "is_typing": is_typing,
        },
    )


async def _dispatch(user_id: int, data: dict) -> None:
    match data.get("type"):
        case "message.send":
            await _handle_message_send(user_id, data)
        case "receipt.delivered":
            await _handle_receipt(user_id, data, "delivered")
        case "receipt.read":
            await _handle_receipt(user_id, data, "read")
        case "typing.start":
            await _handle_typing(user_id, data, True)
        case "typing.stop":
            await _handle_typing(user_id, data, False)


# --------------------------------------------------------------------------- #
# Presence
# --------------------------------------------------------------------------- #
def _touch_last_seen(user_id: int) -> str:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        now = datetime.now(timezone.utc)
        if user is not None:
            user.last_seen_at = now
            db.commit()
        return now.isoformat()
    finally:
        db.close()


def _contacts(user_id: int) -> set[int]:
    db = SessionLocal()
    try:
        return contacts_of(db, user_id)
    finally:
        db.close()


async def _announce_presence(user_id: int, is_online: bool, last_seen: str) -> None:
    await manager.send_to_users(
        _contacts(user_id),
        {
            "type": "presence.update",
            "user_id": user_id,
            "is_online": is_online,
            "last_seen": last_seen,
        },
    )


# --------------------------------------------------------------------------- #
# Endpoint
# --------------------------------------------------------------------------- #
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    was_online = manager.is_online(user_id)
    await manager.connect(user_id, websocket)
    last_seen = _touch_last_seen(user_id)

    # Send this socket a snapshot of which of its contacts are currently online.
    contacts = _contacts(user_id)
    online_contacts = [c for c in contacts if manager.is_online(c)]
    await websocket.send_json(
        {"type": "presence.snapshot", "user_ids": online_contacts}
    )
    # Announce this user's arrival (only on their first live socket).
    if not was_online:
        await _announce_presence(user_id, True, last_seen)

    try:
        while True:
            data = await websocket.receive_json()
            await _dispatch(user_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
        last_seen = _touch_last_seen(user_id)
        if not manager.is_online(user_id):
            await _announce_presence(user_id, False, last_seen)
