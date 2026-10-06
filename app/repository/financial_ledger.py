from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.modules.module import (
    FinancialLedger,
    Order,
    OrderContains,
    Reservation,
    Stock,
    StockLedger,
    ReferenceType,
    TransactionType
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_financial_by_idempotency_key(db: Session, key: str) -> Optional[FinancialLedger]:
    stmt = select(FinancialLedger).where(FinancialLedger.idempotency_key == key)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_financial_by_transaction_id(db: Session, txn_id: str) -> Optional[FinancialLedger]:
    stmt = select(FinancialLedger).where(FinancialLedger.transaction_id == txn_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_financial_ledgers(
    db: Session,
    order_id: Optional[int] = None
) -> List[FinancialLedger]:
    stmt = select(FinancialLedger).order_by(FinancialLedger.created_at.desc(), FinancialLedger.id.desc())
    if order_id is not None:
        stmt = stmt.where(FinancialLedger.order_id == order_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def fulfill_order_payment_atomic(
    db: Session,
    order: Order,
    items: List[OrderContains],
    reservations: List[Reservation],
    txn_id: str,
    amount: float,
    payment_mode: str,
    idempotency_key: Optional[str],
    user_id: int
) -> FinancialLedger:
    """
    Executes payment verification as a single atomic transaction:
    1. Writes FinancialLedger record
    2. Updates Order payment_status='PAID' and order_status='CONFIRMED'
    3. Converts active reservations to 'FULFILLED'
    4. Permanently deducts Stock.quantity with version increment
    5. Appends StockLedger audit entries (STOCK_OUT, reference_type='ORDER')
    """
    now_utc = datetime.now(timezone.utc)
    clean_idempotency_key = idempotency_key.strip() if idempotency_key and idempotency_key.strip() else None
    try:
        # 1. Financial Ledger Entry
        financial_entry = FinancialLedger(
            order_id=order.id,
            transaction_id=txn_id,
            transaction_type='PAYMENT',
            amount=amount,
            payment_mode=payment_mode,
            status='SUCCESS',
            idempotency_key=clean_idempotency_key,
            parent_transaction_id=None,
            created_at=now_utc
        )
        db.add(financial_entry)

        # 2. Update Order
        order.payment_status = 'PAID'
        order.order_status = 'CONFIRMED'

        # Map reservations by order_contains_id for fast lookup
        res_map = {r.order_contains_id: r for r in reservations}

        # 3, 4, 5. Fulfill reservations, deduct stock, and write stock ledger
        for item in items:
            res = res_map.get(item.id)
            if res:
                res.status = 'FULFILLED'

            stock_stmt = select(Stock).where(
                Stock.warehouse_id == order.warehouse_id,
                Stock.product_id == item.product_id
            )
            stock = db.scalar(stock_stmt)
            if not stock or stock.quantity < item.quantity:
                raise ValueError(
                    f"Insufficient stock for product {item.product_id} in warehouse {order.warehouse_id}"
                )

            stock.quantity -= item.quantity
            stock.version = (stock.version or 1) + 1
            stock.updated_at = now_utc

            stock_ledger_entry = StockLedger(
                warehouse_id=order.warehouse_id,
                product_id=item.product_id,
                user_id=user_id,
                change_quantity=item.quantity,
                reference_type=ReferenceType.ORDER,
                reference_id=order.id,
                transaction_type=TransactionType.STOCK_OUT,
                notes=f"Order #{order.id} payment settlement",
                created_at=now_utc
            )
            db.add(stock_ledger_entry)

        db.commit()
        db.refresh(financial_entry)
        db.refresh(order)
        return financial_entry
    except (IntegrityError, ValueError):
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
