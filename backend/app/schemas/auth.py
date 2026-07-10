"""Authentication schemas.

The mocked onboarding flow is two steps:
  1. `start`  — client submits a username; server reports whether it's new.
  2. `verify` — client submits username + OTP (+ profile fields if new);
                server validates the fixed OTP and returns a JWT session.
"""
from pydantic import BaseModel, Field

from app.schemas.user import UserPublic

USERNAME_PATTERN = r"^[a-zA-Z0-9_]{3,32}$"


class AuthStartRequest(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)


class AuthStartResponse(BaseModel):
    username: str
    is_new_user: bool
    # Surfaced to the UI as a hint since verification is mocked.
    otp_hint: str


class AuthVerifyRequest(BaseModel):
    username: str = Field(pattern=USERNAME_PATTERN)
    otp: str
    # Required only when registering a new account.
    display_name: str | None = Field(default=None, max_length=64)
    avatar_color: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
