"""Business logic for login and user management."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.db.models import User, UserRole


async def authenticate(db: AsyncSession, username: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.asc()))
    return list(result.scalars().all())


async def create_user(
    db: AsyncSession, username: str, email: str, password: str, role: str
) -> User:
    existing = await get_user_by_username(db, username)
    if existing is not None:
        raise ValueError(f"Username '{username}' is already taken.")
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole(role),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user_role(db: AsyncSession, user_id: uuid.UUID, role: str) -> User | None:
    user = await db.get(User, user_id)
    if user is None:
        return None
    user.role = UserRole(role)
    await db.commit()
    await db.refresh(user)
    return user
