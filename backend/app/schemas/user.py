"""User-facing Pydantic schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserPublic(BaseModel):
    """A user as exposed to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    avatar_color: str
    avatar_url: str | None
    about: str
    last_seen_at: datetime


class UserUpdate(BaseModel):
    """Editable profile fields (all optional — patch semantics)."""

    display_name: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    about: str | None = None
