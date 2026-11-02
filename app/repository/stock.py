from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, update, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import StockCreate
from app.modules.module import Stock, StockLedger, Warehouse, Product, User, ReferenceType, TransactionType
from app.repository.exceptions import (
    INTERNALDATABASEERROR,
    DATABASEINTEGRITYERROR,
    DATABASEOPERATIONALERROR,
    OptimisticLockConflictError,
    InsufficientStockError,
)


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
    new_quantity: Optional[int] = None,
    change_quantity: int = 0,
    user_id: int = 0,
    notes: Optional[str] = None,
    expected_version: Optional[int] = None,
    is_absolute: bool = False
) -> Stock:
    """
    Executes true SQL-level Optimistic Concurrency Control (OCC) or atomic relative delta
    mutations on the Stock table, and appends a StockLedger audit entry in a single transaction.
    """
    warehouse_id = stock.warehouse_id
    product_id = stock.product_id

    try:
        if is_absolute:
            if expected_version is None:
                raise ValueError("expected_version is required for absolute value adjustments")
            if new_quantity is None or new_quantity < 0:
                raise ValueError("new_quantity >= 0 is required for absolute value adjustments")

            actual_change = abs(new_quantity - (stock.quantity or 0)) if change_quantity == 0 else change_quantity
            ledger_tx_type = tx_type if tx_type else (
                TransactionType.ADJUSTMENT_UP if new_quantity >= (stock.quantity or 0) else TransactionType.ADJUSTMENT_DOWN
            )

            stmt = (
                update(Stock)
                .where(
                    Stock.warehouse_id == warehouse_id,
                    Stock.product_id == product_id,
                    Stock.version == expected_version
                )
                .values(
                    quantity=new_quantity,
                    version=Stock.version + 1,
                    updated_at=func.now()
                )
                .returning(Stock)
            )
            res = db.execute(stmt, execution_options={"populate_existing": True})
            updated_stock = res.scalar_one_or_none()
            if updated_stock is None:
                db.rollback()
                raise OptimisticLockConflictError(f"Optimistic lock conflict: stock version is not {expected_version}")

            ledger = StockLedger(
                warehouse_id=updated_stock.warehouse_id,
                product_id=updated_stock.product_id,
                user_id=user_id,
                change_quantity=actual_change,
                reference_type=ReferenceType.MANUAL_ADJUSTMENT,
                reference_id=None,
                transaction_type=ledger_tx_type,
                notes=notes,
                created_at=datetime.now(timezone.utc)
            )
            db.add(ledger)
            db.commit()
            return updated_stock

        elif tx_type == TransactionType.ADJUSTMENT_UP or tx_type == TransactionType.ADJUSTMENT_UP.value:
            qty_delta = change_quantity if change_quantity > 0 else (
                new_quantity - (stock.quantity or 0) if new_quantity is not None else 0
            )

            where_clauses = [
                Stock.warehouse_id == warehouse_id,
                Stock.product_id == product_id
            ]
            if expected_version is not None:
                where_clauses.append(Stock.version == expected_version)

            stmt = (
                update(Stock)
                .where(*where_clauses)
                .values(
                    quantity=Stock.quantity + qty_delta,
                    version=Stock.version + 1,
                    updated_at=func.now()
                )
                .returning(Stock)
            )
            res = db.execute(stmt, execution_options={"populate_existing": True})
            updated_stock = res.scalar_one_or_none()
            if updated_stock is None:
                db.rollback()
                if expected_version is not None:
                    raise OptimisticLockConflictError(f"Optimistic lock conflict: stock version is not {expected_version}")
                raise InsufficientStockError("Stock record not found for update")

            ledger = StockLedger(
                warehouse_id=updated_stock.warehouse_id,
                product_id=updated_stock.product_id,
                user_id=user_id,
                change_quantity=qty_delta,
                reference_type=ReferenceType.MANUAL_ADJUSTMENT,
                reference_id=None,
                transaction_type=TransactionType.ADJUSTMENT_UP,
                notes=notes,
                created_at=datetime.now(timezone.utc)
            )
            db.add(ledger)
            db.commit()
            return updated_stock

        elif tx_type == TransactionType.ADJUSTMENT_DOWN or tx_type == TransactionType.ADJUSTMENT_DOWN.value:
            qty_delta = change_quantity if change_quantity > 0 else (
                (stock.quantity or 0) - new_quantity if new_quantity is not None else 0
            )

            where_clauses = [
                Stock.warehouse_id == warehouse_id,
                Stock.product_id == product_id,
                Stock.quantity >= qty_delta
            ]
            if expected_version is not None:
                where_clauses.append(Stock.version == expected_version)

            stmt = (
                update(Stock)
                .where(*where_clauses)
                .values(
                    quantity=Stock.quantity - qty_delta,
                    version=Stock.version + 1,
                    updated_at=func.now()
                )
                .returning(Stock)
            )
            res = db.execute(stmt, execution_options={"populate_existing": True})
            updated_stock = res.scalar_one_or_none()
            if updated_stock is None:
                db.rollback()
                curr = db.scalar(select(Stock).where(Stock.warehouse_id == warehouse_id, Stock.product_id == product_id))
                if curr is None:
                    raise InsufficientStockError("Stock record not found")
                if expected_version is not None and curr.version != expected_version:
                    raise OptimisticLockConflictError(f"Optimistic lock conflict: stock version is {curr.version}, expected {expected_version}")
                raise InsufficientStockError(f"Insufficient stock: current quantity is {curr.quantity}, cannot reduce by {qty_delta}")

            ledger = StockLedger(
                warehouse_id=updated_stock.warehouse_id,
                product_id=updated_stock.product_id,
                user_id=user_id,
                change_quantity=qty_delta,
                reference_type=ReferenceType.MANUAL_ADJUSTMENT,
                reference_id=None,
                transaction_type=TransactionType.ADJUSTMENT_DOWN,
                notes=notes,
                created_at=datetime.now(timezone.utc)
            )
            db.add(ledger)
            db.commit()
            return updated_stock

        else:
            raise ValueError(f"Unsupported transaction type: {tx_type}")

    except (OptimisticLockConflictError, InsufficientStockError):
        raise
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
