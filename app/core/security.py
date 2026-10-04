from datetime import timedelta, timezone, datetime
from app.core.config import jwt_config, context
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

def create_password(password: str) -> str:

    new_pass = context.hash(password)

    return new_pass


def verify_password(cur_password: str, saved_password: str) -> bool:

    is_pass = context.verify(cur_password, saved_password)

    return is_pass


def create_tokens(data: dict, time: timedelta) -> str:
    
    claims = data.copy()
    
    expiry = datetime.now(timezone.utc) + time

    claims.update({"exp" : expiry})

    encoded_jwt = jwt.encode(claims, jwt_config.security_key, algorithm = jwt_config.algorithm)

    return encoded_jwt

def create_access_token(email: str, role: str, warehouse_id: int) -> str:

    data = {
        "email": email,
        "role": role,
        "warehouse_id": warehouse_id,
        "type": "access"
    }

    encoded_jwt = create_tokens(data, timedelta(minutes = jwt_config.access_token_expire_minutes))

    return encoded_jwt

def create_refresh_token(email: str, role: str, warehouse_id: int) -> str:

    data = {
        "email": email,
        "role": role,
        "warehouse_id": warehouse_id,
        "type": "refresh"
    }

    encoded_jwt = create_tokens(data, timedelta(days = jwt_config.refresh_token_expire_days))

    return encoded_jwt


def decode_token(token: str) -> dict:

    payload = jwt.decode(token, jwt_config.security_key, algorithms=[jwt_config.algorithm])

    return payload