"""User model.

Accounts are identified by a unique username (Signal uses phone numbers; we use
usernames per the project's chosen identity scheme). Authentication is mocked —
there is no password; a fixed OTP is verified at sign-in. Avatars are rendered
as coloured initials, so we store an assigned `avatar_color`; an optional
`avatar_url` supports real uploaded images later.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(64))
    avatar_color: Mapped[str] = mapped_column(String(16), default="#2c6bed")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    about: Mapped[str] = mapped_column(String(256), default="")

    # Presence: updated whenever the user connects a WebSocket or acts.
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
