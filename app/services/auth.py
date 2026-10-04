from app.core.security import create_access_token, create_refresh_token, verify_password, decode_token
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.schemas.schema import Login
from app.repository.auth import get_user

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