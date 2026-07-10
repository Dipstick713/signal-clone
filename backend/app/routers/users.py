"""User profile routes."""
from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserPublic)
def update_me(
    payload: UserUpdate, current_user: CurrentUser, db: DbSession
) -> User:
    """Update editable profile fields (display name, avatar, about)."""
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
