from typing import Optional, List
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.schemas.schema import Login
from app.modules.module import User
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def get_user(login: Login, db: Session):

    stmt = select(User).where(login.email == User.email)

    try:

        user = db.scalar(stmt)

    except OperationalError:
        raise DATABASEOPERATIONALERROR()

    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()

    return user


def insert_user(db: Session, user: User) -> User:
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR("User with this email already exists or integrity constraint violated.")
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def select_user_by_id(db: Session, user_id: int) -> Optional[User]:
    stmt = select(User).where(User.id == user_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_user_by_email(db: Session, email: str) -> Optional[User]:
    stmt = select(User).where(User.email == email)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def update_user_password(db: Session, user_id: int, new_password_hash: str) -> None:
    try:
        stmt = update(User).where(User.id == user_id).values(password_hash=new_password_hash)
        db.execute(stmt)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def list_users(
    db: Session,
    role: Optional[str] = None,
    warehouse_id: Optional[int] = None
) -> List[User]:
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if warehouse_id is not None:
        stmt = stmt.where(User.warehouse_id == warehouse_id)
    stmt = stmt.order_by(User.id.asc())

    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()