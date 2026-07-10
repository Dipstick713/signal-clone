"""Conversation routes: listing, creation, history, and read receipts.

The list endpoint resolves a per-viewer `title`/avatar (the counterpart for
direct chats, the group's own fields for groups) and computes an unread count
from each participant's read watermark.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, func, select

from app.deps import CurrentUser, DbSession
from app.models.conversation import Conversation, Participant
from app.models.message import Message
from app.models.user import User
from app.schemas.conversation import (
    AddMembersRequest,
    ConversationDetail,
    ConversationListItem,
    CreateDirectRequest,
    CreateGroupRequest,
    MarkReadRequest,
    MessagePublic,
    ParticipantPublic,
    RenameGroupRequest,
)
from app.schemas.user import UserPublic
from app.services.messages import create_system_message, participant_ids
from app.ws.manager import manager

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


async def _broadcast_system_message(db: DbSession, conversation_id: int, body: str):
    """Persist a system notice and fan it out over the socket to all members."""
    msg = create_system_message(db, conversation_id, body)
    await manager.send_to_users(
        participant_ids(db, conversation_id),
        {
            "type": "message.new",
            "temp_id": None,
            "message": MessagePublic.model_validate(msg).model_dump(mode="json"),
        },
    )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _require_participant(
    db: DbSession, conversation_id: int, user_id: int
) -> Participant:
    part = db.scalar(
        select(Participant).where(
            Participant.conversation_id == conversation_id,
            Participant.user_id == user_id,
        )
    )
    if part is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )
    return part


def _resolve_view(conv: Conversation, viewer_id: int) -> tuple[str, str | None, str | None, User | None]:
    """Return (title, avatar_color, avatar_url, other_user) for a viewer."""
    if conv.type == "direct":
        other = next(
            (p.user for p in conv.participants if p.user_id != viewer_id), None
        )
        if other is not None:
            return other.display_name, other.avatar_color, other.avatar_url, other
        return "You", None, None, None
    return conv.name or "Group", conv.avatar_color, conv.avatar_url, None


def _last_message(db: DbSession, conversation_id: int) -> Message | None:
    return db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .limit(1)
    )


def _unread_count(db: DbSession, part: Participant, viewer_id: int) -> int:
    watermark = part.last_read_message_id or 0
    return (
        db.scalar(
            select(func.count(Message.id)).where(
                Message.conversation_id == part.conversation_id,
                Message.id > watermark,
                Message.sender_id != viewer_id,
                Message.deleted_at.is_(None),
            )
        )
        or 0
    )


def _require_admin(db: DbSession, conversation_id: int, user_id: int) -> Participant:
    part = _require_participant(db, conversation_id, user_id)
    if part.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return part


def _require_group(db: DbSession, conversation_id: int) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.type != "group":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
        )
    return conv


def _build_detail(db: DbSession, conv: Conversation, viewer_id: int) -> ConversationDetail:
    title, color, url, other = _resolve_view(conv, viewer_id)
    return ConversationDetail(
        id=conv.id,
        type=conv.type,
        title=title,
        avatar_color=color,
        avatar_url=url,
        created_by=conv.created_by,
        participants=[
            ParticipantPublic(
                user=UserPublic.model_validate(p.user),
                role=p.role,
                last_read_message_id=p.last_read_message_id,
                last_delivered_message_id=p.last_delivered_message_id,
            )
            for p in conv.participants
        ],
        other_user=UserPublic.model_validate(other) if other else None,
    )


def _build_list_item(
    db: DbSession, conv: Conversation, part: Participant, viewer_id: int
) -> ConversationListItem:
    title, color, url, other = _resolve_view(conv, viewer_id)
    last = _last_message(db, conv.id)
    return ConversationListItem(
        id=conv.id,
        type=conv.type,
        title=title,
        avatar_color=color,
        avatar_url=url,
        updated_at=conv.updated_at,
        unread_count=_unread_count(db, part, viewer_id),
        last_message=MessagePublic.model_validate(last) if last else None,
        other_user=UserPublic.model_validate(other) if other else None,
    )


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@router.get("", response_model=list[ConversationListItem])
def list_conversations(current_user: CurrentUser, db: DbSession):
    """All conversations for the current user, most-recent activity first."""
    parts = db.scalars(
        select(Participant).where(Participant.user_id == current_user.id)
    ).all()
    items = [
        _build_list_item(db, part.conversation, part, current_user.id)
        for part in parts
    ]
    items.sort(key=lambda i: i.updated_at, reverse=True)
    return items


@router.post("/direct", response_model=ConversationListItem)
def create_direct(
    payload: CreateDirectRequest, current_user: CurrentUser, db: DbSession
):
    """Open (or create) a 1:1 conversation with another user."""
    if payload.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a conversation with yourself",
        )
    other = db.get(User, payload.user_id)
    if other is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Find an existing direct conversation containing exactly these two users.
    my_direct = (
        select(Participant.conversation_id)
        .join(Conversation, Conversation.id == Participant.conversation_id)
        .where(Participant.user_id == current_user.id, Conversation.type == "direct")
        .subquery()
    )
    existing = db.scalar(
        select(Conversation)
        .join(Participant, Participant.conversation_id == Conversation.id)
        .where(
            Conversation.id.in_(select(my_direct)),
            Participant.user_id == other.id,
        )
    )
    if existing is None:
        existing = Conversation(type="direct")
        existing.participants = [
            Participant(user_id=current_user.id),
            Participant(user_id=other.id),
        ]
        db.add(existing)
        db.commit()
        db.refresh(existing)

    part = _require_participant(db, existing.id, current_user.id)
    return _build_list_item(db, existing, part, current_user.id)


@router.post("/group", response_model=ConversationListItem)
def create_group(
    payload: CreateGroupRequest, current_user: CurrentUser, db: DbSession
):
    """Create a group with the current user as admin plus the given members."""
    member_ids = {current_user.id, *payload.member_ids}
    users = db.scalars(select(User).where(User.id.in_(member_ids))).all()
    if len(users) != len(member_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown member id"
        )

    conv = Conversation(
        type="group",
        name=payload.name.strip(),
        avatar_color="#2c6bed",
        created_by=current_user.id,
    )
    conv.participants = [
        Participant(
            user_id=uid,
            role="admin" if uid == current_user.id else "member",
        )
        for uid in member_ids
    ]
    conv.messages = [
        Message(
            sender_id=None,
            type="system",
            body=f"{current_user.display_name} created the group",
        )
    ]
    db.add(conv)
    db.commit()
    db.refresh(conv)

    part = _require_participant(db, conv.id, current_user.id)
    return _build_list_item(db, conv, part, current_user.id)


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int, current_user: CurrentUser, db: DbSession
):
    _require_participant(db, conversation_id, current_user.id)
    conv = db.get(Conversation, conversation_id)
    assert conv is not None
    return _build_detail(db, conv, current_user.id)


@router.get("/{conversation_id}/messages", response_model=list[MessagePublic])
def get_messages(
    conversation_id: int,
    current_user: CurrentUser,
    db: DbSession,
    before: int | None = Query(None, description="Return messages with id < this"),
    limit: int = Query(50, le=100),
):
    """Paginated message history, oldest→newest within the returned window."""
    _require_participant(db, conversation_id, current_user.id)
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if before is not None:
        stmt = stmt.where(Message.id < before)
    stmt = stmt.order_by(Message.id.desc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    rows.reverse()
    return [MessagePublic.model_validate(m) for m in rows]


@router.post("/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    conversation_id: int,
    payload: MarkReadRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Advance the current user's read watermark for a conversation."""
    part = _require_participant(db, conversation_id, current_user.id)
    if part.last_read_message_id is None or payload.message_id > part.last_read_message_id:
        part.last_read_message_id = payload.message_id
        db.commit()


@router.post("/{conversation_id}/members", response_model=ConversationDetail)
async def add_members(
    conversation_id: int,
    payload: AddMembersRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Admin-only: add members to a group and post a system notice."""
    conv = _require_group(db, conversation_id)
    _require_admin(db, conversation_id, current_user.id)

    existing = participant_ids(db, conversation_id)
    to_add = [uid for uid in dict.fromkeys(payload.user_ids) if uid not in existing]
    users = db.scalars(select(User).where(User.id.in_(to_add))).all() if to_add else []
    if len(users) != len(to_add):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown user id"
        )

    for u in users:
        db.add(Participant(conversation_id=conversation_id, user_id=u.id, role="member"))
    db.commit()

    if users:
        names = ", ".join(u.display_name for u in users)
        await _broadcast_system_message(
            db, conversation_id, f"{current_user.display_name} added {names}"
        )
    db.refresh(conv)
    return _build_detail(db, conv, current_user.id)


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: int,
    user_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """Remove a member (admin), or leave the group (removing yourself)."""
    _require_group(db, conversation_id)
    target = _require_participant(db, conversation_id, user_id)
    is_self = user_id == current_user.id
    if not is_self:
        _require_admin(db, conversation_id, current_user.id)

    target_user = db.get(User, user_id)
    db.delete(target)
    db.commit()

    display = target_user.display_name if target_user else "Someone"
    body = (
        f"{display} left the group"
        if is_self
        else f"{current_user.display_name} removed {display}"
    )
    await _broadcast_system_message(db, conversation_id, body)
    # Tell the removed user's clients to drop the conversation.
    await manager.send_to_users(
        {user_id},
        {"type": "conversation.removed", "conversation_id": conversation_id},
    )


@router.patch("/{conversation_id}", response_model=ConversationDetail)
async def rename_group(
    conversation_id: int,
    payload: RenameGroupRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    """Admin-only: rename a group."""
    conv = _require_group(db, conversation_id)
    _require_admin(db, conversation_id, current_user.id)

    conv.name = payload.name.strip()
    db.commit()
    await _broadcast_system_message(
        db,
        conversation_id,
        f'{current_user.display_name} changed the group name to "{conv.name}"',
    )
    db.refresh(conv)
    return _build_detail(db, conv, current_user.id)
