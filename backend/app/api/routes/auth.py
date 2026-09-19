"""Login + user management — the human side of the hybrid JWT/API-key auth
design (see app/core/security.py's module docstring for the full design)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import Principal, create_access_token, get_current_principal, require_role
from app.db.database import get_db
from app.schemas.schemas import LoginRequest, Token, UserCreate, UserOut, UserRoleUpdate
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=Token)
@limiter.limit(f"{settings.rate_limit_login_per_minute}/minute")
async def login(
    request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)
) -> Token:
    user = await auth_service.authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password."
        )
    token = create_access_token(user.username, user.role.value)
    return Token(access_token=token, role=user.role.value)


@router.get("/me", response_model=UserOut)
async def read_current_user(
    principal: Principal = Depends(get_current_principal), db: AsyncSession = Depends(get_db)
) -> UserOut:
    if principal.auth_method != "jwt":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint requires a logged-in user (Bearer token), not an API key.",
        )
    user = await auth_service.get_user_by_username(db, principal.username)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut.model_validate(user)


@router.get(
    "/users", response_model=list[UserOut], dependencies=[Depends(require_role("admin"))]
)
async def list_users(db: AsyncSession = Depends(get_db)) -> list[UserOut]:
    users = await auth_service.list_users(db)
    return [UserOut.model_validate(u) for u in users]


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("admin"))],
)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)) -> UserOut:
    try:
        user = await auth_service.create_user(
            db, body.username, body.email, body.password, body.role
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserOut.model_validate(user)


@router.patch(
    "/users/{user_id}/role",
    response_model=UserOut,
    dependencies=[Depends(require_role("admin"))],
)
async def update_user_role(
    user_id: uuid.UUID, body: UserRoleUpdate, db: AsyncSession = Depends(get_db)
) -> UserOut:
    user = await auth_service.update_user_role(db, user_id, body.role)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut.model_validate(user)
