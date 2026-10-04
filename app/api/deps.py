from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import jwt_config
from app.core.security import create_access_token
import jwt

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_user(token: str = Depends(oauth2_scheme)):

    try:
        user = jwt.decode(token, jwt_config.security_key, algorithms=[jwt_config.algorithm])

        if user.get("type") != "access":
            raise HTTPException(
                status_code = status.HTTP_401_UNAUTHORIZED,
                detail = "Unauthorized access"
            )
        return user
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Unauthorized access")

def is_user_admin(user: dict = Depends(get_user)):

    if user.get("role") != "admin":
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Forbidden Operation"
        )

    return user

def verify_token(token: str = Depends(oauth2_scheme)):

    try:
        user = jwt.decode(token, jwt_config.security_key,algorithms=[jwt_config.algorithm])

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Unauthorized access")

    