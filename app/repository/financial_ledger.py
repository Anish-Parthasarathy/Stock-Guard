from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, update, func
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
from app.repository.exceptions import (
    INTERNALDATABASEERROR,
    DATABASEINTEGRITYERROR,
    DATABASEOPERATIONALERROR,
    ReservationExpiredError,
    InsufficientStockError,
)


def select_financial_by_idempotency_key(db: Session, key: str) -> Optional[FinancialLedger]:
    stmt = select(FinancialLedger).where(FinancialLedger.idempotency_key == key)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_financial_by_transaction_id(db: Session, txn_id: str) -> Optional[FinancialLedger]:
    stmt = select(FinancialLedger).where(FinancialLedger.transaction_id == txn_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise
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
        raise
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def fulfill_order_payment_atomic(
    db: Session,
    order: Order,
    items: Optional[List[OrderContains]],
    reservations: Optional[List[Reservation]],
    txn_id: str,
    amount: float,
    payment_mode: str,
    idempotency_key: Optional[str],
    user_id: int
) -> FinancialLedger:
    """
    Executes payment verification as a single atomic transaction:
    1. Verifies reservation validity under row-level locks using the engine clock func.now().
       If any reservation is expired, marks order CANCELLED, remaining holds EXPIRED, and raises ReservationExpiredError.
    2. Writes FinancialLedger record
    3. Updates Order payment_status='PAID' and order_status='CONFIRMED'
    4. Converts active reservations to 'FULFILLED'
    5. Permanently deducts Stock.quantity with version increment in deterministic product_id ASC order
    6. Appends StockLedger audit entries (STOCK_OUT, reference_type='ORDER')
    """
    now_utc = datetime.now(timezone.utc)
    clean_idempotency_key = idempotency_key.strip() if idempotency_key and idempotency_key.strip() else None
    try:
        # 1. Lock and verify reservations associated with the order
        locked_reservations_stmt = (
            select(Reservation)
            .where(Reservation.order_id == order.id)
            .with_for_update()
        )
        locked_reservations = list(db.scalars(locked_reservations_stmt).all())

        # Check for any expired reservations using the engine clock
        expired_count = db.scalar(
            select(func.count(Reservation.id)).where(
                Reservation.order_id == order.id,
                Reservation.status == 'RESERVED',
                Reservation.expire_at <= func.now()
            )
        ) or 0

        if expired_count > 0 or not locked_reservations:
            order.order_status = 'CANCELLED'
            for r in locked_reservations:
                if r.status == 'RESERVED':
                    r.status = 'EXPIRED'
            db.commit()
            raise ReservationExpiredError("Reservation expired prior to payment")

        # 2. Financial Ledger Entry
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

        # 3. Update Order status
        order.payment_status = 'PAID'
        order.order_status = 'CONFIRMED'

        # 4. Mark reservations as FULFILLED
        for r in locked_reservations:
            if r.status == 'RESERVED':
                r.status = 'FULFILLED'

        # 5. Fetch line items and sort by product_id ASC for deterministic lock ordering
        if not items:
            items_stmt = select(OrderContains).where(OrderContains.order_id == order.id)
            items = list(db.scalars(items_stmt).all())
        sorted_items = sorted(items, key=lambda it: it.product_id)

        # 6. Deduct stock atomically and append StockLedger audit entries
        for item in sorted_items:
            update_stmt = (
                update(Stock)
                .where(
                    Stock.warehouse_id == order.warehouse_id,
                    Stock.product_id == item.product_id,
                    Stock.quantity >= item.quantity
                )
                .values(
                    quantity=Stock.quantity - item.quantity,
                    version=Stock.version + 1,
                    updated_at=now_utc
                )
                .returning(Stock)
            )
            res = db.execute(update_stmt, execution_options={"populate_existing": True})
            updated_stock = res.scalar_one_or_none()
            if updated_stock is None:
                db.rollback()
                raise InsufficientStockError(
                    f"Insufficient stock for product {item.product_id} in warehouse {order.warehouse_id}"
                )

            stock_ledger_entry = StockLedger(
                warehouse_id=updated_stock.warehouse_id,
                product_id=updated_stock.product_id,
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
    except (ReservationExpiredError, InsufficientStockError):
        raise
    except OperationalError:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
