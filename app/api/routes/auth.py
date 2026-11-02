from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.schemas.schema import (
    Login,
    LoginRespose,
    Refresh,
    UserCreate,
    UserResponse,
    PasswordChangeRequest,
    AdminResetPasswordRequest,
)
from app.services.auth import (
    post_login,
    post_refresh,
    create_user_service,
    change_password_service,
    admin_reset_password_service,
    list_users_service,
)
from app.api.deps import get_db, get_user, is_user_admin

router = APIRouter()
user_router = APIRouter()

@router.post('/login', response_model = LoginRespose)
async def LoginRequest(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = post_login(Login(email = form.username, password = form.password), db)
    
    return user

@router.post('/refresh')
async def refresh(body: Refresh):
    
    access_token = post_refresh(body.token)

    return access_token


# --- Admin User Provisioning & Listing ---

@router.post('/users', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@user_router.post('', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_user_admin)
):
    user = create_user_service(body, db)
    return user


@router.get('/users', response_model=List[UserResponse], status_code=status.HTTP_200_OK)
@user_router.get('', response_model=List[UserResponse], status_code=status.HTTP_200_OK)
async def list_users_endpoint(
    role: Optional[str] = Query(None),
    warehouse_id: Optional[int] = Query(None, gt=0),
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_user_admin)
):
    users = list_users_service(db, role=role, warehouse_id=warehouse_id)
    return users


# --- Password Management ---

@router.post('/change-password', status_code=status.HTTP_200_OK)
async def change_password_endpoint(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_user)
):
    change_password_service(current_user["email"], body, db)
    return {"message": "Password updated successfully"}


@router.post('/users/{user_id}/reset-password', status_code=status.HTTP_200_OK)
@user_router.post('/{user_id}/reset-password', status_code=status.HTTP_200_OK)
async def reset_password_endpoint(
    user_id: int,
    body: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_admin: dict = Depends(is_user_admin)
):
    admin_reset_password_service(user_id, body, db)
    return {"message": "Password reset successfully"}