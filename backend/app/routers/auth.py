"""Authentication routes — mocked username + fixed-OTP onboarding."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.config import settings
from app.core.constants import color_for
from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthStartRequest,
    AuthStartResponse,
    AuthVerifyRequest,
)
from app.schemas.user import UserPublic
from app.core.security import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_user_by_username(db: DbSession, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


@router.post("/start", response_model=AuthStartResponse)
def start(payload: AuthStartRequest, db: DbSession) -> AuthStartResponse:
    """Report whether a username belongs to an existing account.

    Drives the UI: existing users go straight to OTP + login, new users
    additionally collect a display name. No account is created here.
    """
    existing = _get_user_by_username(db, payload.username)
    return AuthStartResponse(
        username=payload.username,
        is_new_user=existing is None,
        otp_hint=settings.mock_otp,
    )


@router.post("/verify", response_model=AuthResponse)
def verify(payload: AuthVerifyRequest, db: DbSession) -> AuthResponse:
    """Validate the fixed OTP and return a session, registering if needed."""
    if payload.otp != settings.mock_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code"
        )

    user = _get_user_by_username(db, payload.username)
    if user is None:
        # New account — a display name is required to register.
        display_name = (payload.display_name or "").strip()
        if not display_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Display name is required to register",
            )
        user = User(
            username=payload.username,
            display_name=display_name,
            avatar_color=payload.avatar_color or color_for(payload.username),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Returning user — mark them active.
        user.last_seen_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: CurrentUser) -> User:
    """Return the authenticated user — used by the client to restore a session."""
    return current_user
