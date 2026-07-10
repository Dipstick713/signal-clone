"""Message-related database operations shared by the WebSocket and REST layers."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Participant
from app.models.message import Message


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


def create_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    body: str,
    reply_to_id: int | None = None,
) -> Message:
    """Persist a text message and bump the conversation's activity timestamp."""
    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        body=body,
        type="text",
        reply_to_id=reply_to_id,
    )
    db.add(msg)

    conv = db.get(Conversation, conversation_id)
    if conv is not None:
        conv.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(msg)
    return msg
