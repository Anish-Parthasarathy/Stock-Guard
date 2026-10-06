from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import StockCreate
from app.modules.module import Stock, StockLedger, Warehouse, Product, User, ReferenceType, TransactionType
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_stock_by_warehouse_product(db: Session, warehouse_id: int, product_id: int) -> Optional[Stock]:
    stmt = select(Stock).where(Stock.warehouse_id == warehouse_id, Stock.product_id == product_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_stocks(
    db: Session,
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    low_stock: Optional[bool] = None
) -> List[Stock]:
    stmt = select(Stock)
    if warehouse_id is not None:
        stmt = stmt.where(Stock.warehouse_id == warehouse_id)
    if product_id is not None:
        stmt = stmt.where(Stock.product_id == product_id)
    if low_stock is True:
        stmt = stmt.where(Stock.quantity <= Stock.reorder_threshold)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_warehouse_by_id(db: Session, warehouse_id: int) -> Optional[Warehouse]:
    stmt = select(Warehouse).where(Warehouse.id == warehouse_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_product_by_id(db: Session, product_id: int) -> Optional[Product]:
    stmt = select(Product).where(Product.id == product_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
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


def insert_stock(db: Session, stock_data: StockCreate, user_id: Optional[int] = None) -> Stock:
    try:
        new_stock = Stock(
            warehouse_id=stock_data.warehouse_id,
            product_id=stock_data.product_id,
            quantity=stock_data.quantity,
            version=1,
            updated_at=datetime.now(timezone.utc),
            reorder_threshold=stock_data.reorder_threshold
        )
        db.add(new_stock)

        # Only write a ledger entry when there is an initial non-zero quantity
        # and a known user to attribute it to.
        if stock_data.quantity > 0 and user_id is not None:
            ledger = StockLedger(
                product_id=stock_data.product_id,
                warehouse_id=stock_data.warehouse_id,
                user_id=user_id,
                change_quantity=stock_data.quantity,
                reference_type=ReferenceType.MANUAL_ADJUSTMENT,
                reference_id=None,
                transaction_type=TransactionType.STOCK_IN,
                notes="Initial stock creation",
                created_at=datetime.now(timezone.utc)
            )
            db.add(ledger)

        db.commit()
        db.refresh(new_stock)
        return new_stock
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def adjust_stock(
    db: Session,
    stock: Stock,
    tx_type: TransactionType,
    new_quantity: int,
    change_quantity: int,
    user_id: int,
    notes: Optional[str] = None
) -> Stock:
    """
    Atomically updates the Stock row and appends a StockLedger audit entry.
    The caller (service) is responsible for all business-logic validation
    (sufficient quantity, version check, valid tx_type).
    """
    try:
        stock.quantity = new_quantity
        stock.version = (stock.version or 1) + 1
        stock.updated_at = datetime.now(timezone.utc)

        ledger = StockLedger(
            product_id=stock.product_id,
            warehouse_id=stock.warehouse_id,
            user_id=user_id,
            change_quantity=change_quantity,
            reference_type=ReferenceType.MANUAL_ADJUSTMENT,
            reference_id=None,
            transaction_type=tx_type,
            notes=notes,
            created_at=datetime.now(timezone.utc)
        )
        db.add(ledger)

        db.commit()
        db.refresh(stock)
        return stock
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def select_stock_ledgers(
    db: Session,
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None
) -> List[StockLedger]:
    stmt = select(StockLedger).order_by(StockLedger.created_at.desc(), StockLedger.id.desc())
    if warehouse_id is not None:
        stmt = stmt.where(StockLedger.warehouse_id == warehouse_id)
    if product_id is not None:
        stmt = stmt.where(StockLedger.product_id == product_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()
