from app.core.config import settings
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, DeclarativeBase

engine = create_engine(settings.DATABASE_URL, pool_pre_ping = True)

SessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = engine)

convention = {
    "ix": "ix_%(column_0_label)s",  # Indexes
    "uq": "uq_%(table_name)s_%(column_0_name)s",  # Unique constraints
    "ck": "ck_%(table_name)s_%(constraint_name)s",  # Check constraints
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",  # Foreign keys
    "pk": "pk_%(table_name)s"  # Primary keys
}

metadata = MetaData(naming_convention = convention)

class Base(DeclarativeBase):
    metadata = metadata