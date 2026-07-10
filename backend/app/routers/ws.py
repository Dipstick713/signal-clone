"""Real-time WebSocket endpoint.

Clients connect to `/ws?token=<jwt>`. The socket carries a small JSON event
protocol; in this phase it handles sending messages and fans the persisted
message back out to every participant (including the sender, tagged with the
client's `temp_id` so it can reconcile its optimistic bubble).

    client → server:  { "type": "message.send", "conversation_id", "body",
                        "temp_id"?, "reply_to_id"? }
    server → client:  { "type": "message.new", "temp_id"?, "message": {...} }
                      { "type": "error", "detail": "..." }
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.conversation import MessagePublic
from app.services.messages import create_message, is_participant, participant_ids
from app.ws.manager import manager

router = APIRouter()


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


async def _dispatch(user_id: int, data: dict) -> None:
    match data.get("type"):
        case "message.send":
            await _handle_message_send(user_id, data)
        # Future: typing.*, receipt.* (added in the next phase)


def _touch_last_seen(user_id: int) -> None:
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if user is not None:
            user.last_seen_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=4401)
        return

    await manager.connect(user_id, websocket)
    _touch_last_seen(user_id)
    try:
        while True:
            data = await websocket.receive_json()
            await _dispatch(user_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, websocket)
        _touch_last_seen(user_id)
