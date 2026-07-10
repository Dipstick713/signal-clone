"""Presence helpers: who shares a conversation with whom."""
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.models.conversation import Participant


def contacts_of(db: Session, user_id: int) -> set[int]:
    """User ids that share at least one conversation with `user_id`.

    These are the people who should hear about this user's presence changes.
    """
    my_conversations = select(Participant.conversation_id).where(
        Participant.user_id == user_id
    )
    rows = db.scalars(
        select(distinct(Participant.user_id)).where(
            Participant.conversation_id.in_(my_conversations),
            Participant.user_id != user_id,
        )
    ).all()
    return set(rows)
