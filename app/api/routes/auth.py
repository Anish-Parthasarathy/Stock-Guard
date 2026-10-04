from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.sql.functions import user
from fastapi import Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.schema import Login, LoginRespose, Refresh
from app.services.auth import post_login, post_refresh
from app.api.deps import get_db

router = APIRouter()

@router.post('/login', response_model = LoginRespose)
async def LoginRequest(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = post_login(Login(email = form.username, password = form.password), db)
    
    return user

@router.post('/refresh')
async def refresh(body: Refresh):
    
    access_token = post_refresh(body.token)

    return access_token