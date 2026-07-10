"""SQLAlchemy models.

Importing this package imports every model module so that they register with
`Base.metadata` before `create_all` runs.
"""
from app.models.attachment import Attachment
from app.models.conversation import Conversation, Participant
from app.models.message import Message, MessageReaction
from app.models.user import User

__all__ = [
    "User",
    "Conversation",
    "Participant",
    "Message",
    "MessageReaction",
    "Attachment",
]
