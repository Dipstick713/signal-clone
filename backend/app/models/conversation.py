"""Conversation and Participant models.

Design note — one model for both chat types. A direct (1:1) chat is simply a
`Conversation` with `type="direct"` and exactly two participants; a group has
`type="group"`, a name, and any number of participants. This keeps DMs and
groups on a single code path for listing, messaging, and receipts.

`Participant.last_read_message_id` is the read watermark that powers unread
counts and read receipts without a row per message per user.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(16))  # "direct" | "group"
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)  # groups
    avatar_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Bumped on every new message so the list can sort by recent activity.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # "admin"|"member"
    # Read watermark: id of the last message this user has seen.
    last_read_message_id: Mapped[int | None] = mapped_column(nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()


# Imported after class definitions to satisfy relationship() string references.
from app.models.message import Message  # noqa: E402
from app.models.user import User  # noqa: E402
