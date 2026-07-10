"""Message-related database operations shared by the WebSocket and REST layers."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Participant
from app.models.message import Message, MessageReaction


def _advance_watermark(
    db: Session, conversation_id: int, user_id: int, field: str, message_id: int
) -> int | None:
    """Advance a participant's read/delivered watermark if the id is newer.

    Returns the new watermark value, or None if the user is not a participant
    or the watermark did not move forward.
    """
    part = db.scalar(
        select(Participant).where(
            Participant.conversation_id == conversation_id,
            Participant.user_id == user_id,
        )
    )
    if part is None:
        return None
    current = getattr(part, field) or 0
    if message_id <= current:
        return None
    setattr(part, field, message_id)
    db.commit()
    return message_id


def advance_delivered(db, conversation_id, user_id, message_id) -> int | None:
    return _advance_watermark(
        db, conversation_id, user_id, "last_delivered_message_id", message_id
    )


def advance_read(db, conversation_id, user_id, message_id) -> int | None:
    return _advance_watermark(
        db, conversation_id, user_id, "last_read_message_id", message_id
    )


def participant_ids(db: Session, conversation_id: int) -> set[int]:
    rows = db.scalars(
        select(Participant.user_id).where(
            Participant.conversation_id == conversation_id
        )
    ).all()
    return set(rows)


def is_participant(db: Session, conversation_id: int, user_id: int) -> bool:
    return db.scalar(
        select(Participant.id).where(
            Participant.conversation_id == conversation_id,
            Participant.user_id == user_id,
        )
    ) is not None


def _persist(db: Session, msg: Message) -> Message:
    db.add(msg)
    conv = db.get(Conversation, msg.conversation_id)
    if conv is not None:
        conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    return msg


def create_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    body: str,
    reply_to_id: int | None = None,
) -> Message:
    """Persist a text message and bump the conversation's activity timestamp."""
    return _persist(
        db,
        Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            body=body,
            type="text",
            reply_to_id=reply_to_id,
        ),
    )


def toggle_reaction(
    db: Session, message_id: int, user_id: int, emoji: str
) -> tuple[Message, bool] | None:
    """Add or remove a user's emoji reaction on a message (toggle).

    Returns (message, added) where `added` is True if the reaction was added,
    False if it was removed. Returns None if the message doesn't exist.
    """
    msg = db.get(Message, message_id)
    if msg is None:
        return None
    existing = db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji,
        )
    )
    if existing is not None:
        db.delete(existing)
        db.commit()
        return msg, False
    db.add(MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji))
    db.commit()
    return msg, True


def create_system_message(db: Session, conversation_id: int, body: str) -> Message:
    """Persist a system notice (e.g. membership changes)."""
    return _persist(
        db,
        Message(
            conversation_id=conversation_id, sender_id=None, body=body, type="system"
        ),
    )
