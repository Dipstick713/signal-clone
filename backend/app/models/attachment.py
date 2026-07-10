"""Attachment model.

Image bytes are stored directly in the database (a BLOB). For this assignment
that keeps deployment simple and durable — there's no external object store to
configure, and attachments survive a redeploy on hosts with an ephemeral disk.
A production system would offload bytes to S3/GCS and store only a URL here.

An attachment is uploaded first (unlinked), then bound to a message when it is
sent (`message_id` set).
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), nullable=True, index=True
    )
    uploader_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    mime: Mapped[str] = mapped_column(String(64))
    filename: Mapped[str] = mapped_column(String(255))
    size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    message: Mapped["Message | None"] = relationship(back_populates="attachment")
