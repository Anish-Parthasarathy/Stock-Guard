import inspect
import random
import time
from typing import Callable, Any
from app.core.config import settings
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.repository.exceptions import ConcurrencyDeadlockError

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=20, max_overflow=40)

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


PG_DEADLOCK_ERROR_CODES = {"40P01", "40001"}


def _is_deadlock_or_serialization_failure(e: OperationalError) -> bool:
    orig = getattr(e, "orig", None)
    if orig is not None:
        # Support both database drivers: psycopg2 ('pgcode') and psycopg3 ('sqlstate')
        code = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None)
        if code in PG_DEADLOCK_ERROR_CODES:
            return True
        diag = getattr(orig, "diag", None)
        if diag is not None:
            diag_code = getattr(diag, "sqlstate", None)
            if diag_code in PG_DEADLOCK_ERROR_CODES:
                return True

    err_str = str(e).lower()
    return "40p01" in err_str or "40001" in err_str or "deadlock detected" in err_str or "could not serialize" in err_str


def _call_callable(fn: Callable, db: Session, *args, **kwargs) -> Any:
    takes_db = False
    takes_no_args = False
    try:
        sig = inspect.signature(fn)
        params = list(sig.parameters.values())
        if len(params) == 0:
            takes_no_args = True
        elif len(params) > 0 and (params[0].name in ("db", "session") or len(args) == 0):
            takes_db = True
    except (ValueError, TypeError):
        takes_db = True

    if takes_no_args:
        return fn()
    elif takes_db:
        return fn(db, *args, **kwargs)
    else:
        return fn(*args, **kwargs)


def run_in_transaction_with_retry(
    db: Session,
    fn: Callable,
    max_retries: int = 3,
    *args,
    **kwargs
) -> Any:
    """
    Executes a callable inside a transactional boundary with fail-fast timeouts
    and automatic retries on transient PostgreSQL deadlocks (40P01) or
    serialization failures (40001).

    Applies exponential backoff with full jitter:
        t = random(0, min(200ms, 20ms * 2^attempt))
    """
    attempt = 0
    while True:
        try:
            # Set local lock timeout at transaction start
            try:
                db.execute(text("SET LOCAL lock_timeout = '3s';"))
            except Exception:
                pass

            result = _call_callable(fn, db, *args, **kwargs)
            db.commit()
            return result
        except OperationalError as e:
            db.rollback()
            if _is_deadlock_or_serialization_failure(e):
                if attempt < max_retries:
                    # Exponential backoff with full jitter: t = random(0, min(200ms, 20ms * 2^attempt))
                    max_backoff_sec = min(0.200, 0.020 * (2 ** attempt))
                    jitter_sleep = random.uniform(0, max_backoff_sec)
                    time.sleep(jitter_sleep)
                    attempt += 1
                    continue
                raise ConcurrencyDeadlockError(
                    f"Deadlock or serialization failure occurred after {max_retries} retries."
                ) from e
            raise
        except Exception:
            db.rollback()
            raise