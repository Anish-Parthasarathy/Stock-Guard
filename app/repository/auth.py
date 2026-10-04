from sqlalchemy import select
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