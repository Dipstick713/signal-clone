"""Message model.

`type` distinguishes normal `text` messages from `system` notices (e.g.
"Alice created the group"). `reply_to_id` supports quoted replies (bonus).
`deleted_at` enables soft-delete so history/threading stays intact.
Delivery/read receipts are added in a later phase.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True  # null for system messages
    )
    body: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(16), default="text")  # "text"|"system"
    reply_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
    edited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sender: Mapped["User | None"] = relationship()
    reply_to: Mapped["Message | None"] = relationship(remote_side=[id])
