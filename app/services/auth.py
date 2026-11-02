from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
    decode_token,
    create_password,
)
from app.schemas.schema import Login, UserCreate, PasswordChangeRequest, AdminResetPasswordRequest
from app.modules.module import User, Warehouse
from app.repository.auth import (
    get_user,
    insert_user,
    select_user_by_id,
    select_user_by_email,
    update_user_password,
    list_users,
)
from app.repository.exceptions import DATABASEINTEGRITYERROR

def post_login(login: Login, db: Session):
    
    user = get_user(login, db)

    if user is None:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Incorrect username or password"
        )

    if verify_password(login.password, user.password_hash):
        
        access_token = create_access_token(email = user.email, role = user.role, warehouse_id = user.warehouse_id)
        refresh_token = create_refresh_token(email = user.email, role = user.role, warehouse_id = user.warehouse_id)
        
        return {
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "warehouse_id": user.warehouse_id,
            "created_at": user.created_at,
            "access_token": access_token,
            "refresh_token": refresh_token,
        }

    else:

        raise HTTPException (
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Incorrect username or password"
        )


def post_refresh(refresh_token: str) -> str:

    try:
        user = decode_token(refresh_token)
    except Exception:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Unauthorized access"
        )
    
    if user.get("type") != "refresh":
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Unauthorized access"
        )

    jwt_token = create_access_token(user.get("email"), user.get("role"), user.get("warehouse_id"))

    return jwt_token


def create_user_service(data: UserCreate, db: Session) -> User:
    existing_user = select_user_by_email(db, data.email)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{data.email}' already exists"
        )

    if data.warehouse_id is not None:
        warehouse = db.scalar(select(Warehouse).where(Warehouse.id == data.warehouse_id))
        if warehouse is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {data.warehouse_id} not found"
            )

    password_hash = create_password(data.password)

    new_user = User(
        name=data.name,
        email=data.email,
        password_hash=password_hash,
        role=data.role,
        warehouse_id=data.warehouse_id,
        created_at=datetime.now(timezone.utc)
    )

    try:
        user = insert_user(db, new_user)
        return user
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


def change_password_service(email: str, data: PasswordChangeRequest, db: Session) -> None:
    user = select_user_by_email(db, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    new_password_hash = create_password(data.new_password)
    update_user_password(db, user.id, new_password_hash)


def admin_reset_password_service(target_user_id: int, data: AdminResetPasswordRequest, db: Session) -> None:
    user = select_user_by_id(db, target_user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {target_user_id} not found"
        )

    new_password_hash = create_password(data.new_password)
    update_user_password(db, target_user_id, new_password_hash)


def list_users_service(
    db: Session,
    role: Optional[str] = None,
    warehouse_id: Optional[int] = None
) -> List[User]:
    return list_users(db, role=role, warehouse_id=warehouse_id)