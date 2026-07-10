"""Conversation, participant, and message schemas."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class ReactionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emoji: str
    user_id: int


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int | None
    body: str
    type: str
    reply_to_id: int | None
    created_at: datetime
    edited_at: datetime | None
    deleted_at: datetime | None
    reactions: list[ReactionPublic] = []


class ParticipantPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserPublic
    role: str
    last_read_message_id: int | None = None
    last_delivered_message_id: int | None = None


class ConversationListItem(BaseModel):
    """A conversation as shown in the left rail.

    `title`/`avatar_*` are resolved per-viewer: for a direct chat they are the
    *other* participant's; for a group they are the group's own fields.
    """

    id: int
    type: str
    title: str
    avatar_color: str | None
    avatar_url: str | None
    updated_at: datetime
    unread_count: int
    last_message: MessagePublic | None
    # For direct chats, the counterpart user (for presence, etc.).
    other_user: UserPublic | None = None


class ConversationDetail(BaseModel):
    id: int
    type: str
    title: str
    avatar_color: str | None
    avatar_url: str | None
    created_by: int | None
    participants: list[ParticipantPublic]
    other_user: UserPublic | None = None


class CreateDirectRequest(BaseModel):
    user_id: int


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    member_ids: list[int]


class MarkReadRequest(BaseModel):
    message_id: int


class AddMembersRequest(BaseModel):
    user_ids: list[int] = Field(min_length=1)


class RenameGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
