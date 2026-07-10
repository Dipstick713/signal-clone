"""User profile and directory routes."""
from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
def get_me(current_user: CurrentUser) -> User:
    return current_user


@router.get("/search", response_model=list[UserPublic])
def search_users(
    current_user: CurrentUser,
    db: DbSession,
    q: str = Query("", description="Match username or display name (prefix/substring)"),
    limit: int = Query(20, le=50),
):
    """Find users to start a conversation with. Excludes the caller."""
    term = f"%{q.strip()}%"
    stmt = (
        select(User)
        .where(
            User.id != current_user.id,
            or_(User.username.ilike(term), User.display_name.ilike(term)),
        )
        .order_by(User.display_name)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


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
