from pydantic_settings import BaseSettings, SettingsConfigDict
from passlib.context import CryptContext
class Settings(BaseSettings):

    DATABASE_URL: str
    secret_key: str = "default_unsafe_secret" # You can provide default fallbacks
    debug_mode: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

context = CryptContext(
        schemes = ["argon2"],
        deprecated = "auto",
        argon2__memory_cost = 65536,
        argon2__time_cost = 3,
        argon2__parallelism = 4
    )

class JWTConfig(BaseSettings):
    security_key: str
    algorithm: str
    access_token_expire_minutes: int = 7
    refresh_token_expire_days: int = 30
    issuer: str = "auth-service"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


jwt_config = JWTConfig()