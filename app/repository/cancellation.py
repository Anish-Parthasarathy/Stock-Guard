import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.modules.module import (
    Cancellation,
    Order,
    OrderContains,
    Reservation,
    Stock,
    StockLedger,
    FinancialLedger,
    ReferenceType,
    TransactionType
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_cancellations(
    db: Session,
    order_id: Optional[int] = None
) -> List[Cancellation]:
    stmt = select(Cancellation).order_by(Cancellation.created_at.desc(), Cancellation.id.desc())
    if order_id is not None:
        stmt = stmt.where(Cancellation.order_id == order_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_cancellation_by_id(db: Session, cancellation_id: int) -> Optional[Cancellation]:
    stmt = select(Cancellation).where(Cancellation.id == cancellation_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def cancel_order_atomic(
    db: Session,
    order: Order,
    reason: str,
    user_id: int,
    refund_needed: bool,
    original_payment: Optional[FinancialLedger] = None
) -> Cancellation:
    """
    Executes order cancellation as a single atomic transaction:
    1. If order was paid, writes refund FinancialLedger and restocks inventory with StockLedger entries.
    2. If order was unfulfilled, releases active reservations.
    3. Updates Order status to 'CANCELLED'.
    4. Writes Cancellation record.
    """
    now_utc = datetime.now(timezone.utc)
    try:
        refund_entry_id = None
        if refund_needed:
            pay_mode = original_payment.payment_mode if original_payment else "REFUND"
            parent_id = original_payment.id if original_payment else None
            refund_entry = FinancialLedger(
                order_id=order.id,
                transaction_id=f"RFD-{uuid.uuid4().hex[:12].upper()}",
                transaction_type='REFUND',
                amount=float(order.total_amount),
                payment_mode=pay_mode,
                status='SUCCESS',
                idempotency_key=None,
                parent_transaction_id=parent_id,
                created_at=now_utc
            )
            db.add(refund_entry)
            db.flush()
            refund_entry_id = refund_entry.id
            order.payment_status = 'REFUNDED'

            # Restock fulfilled items back to inventory
            items_stmt = select(OrderContains).where(OrderContains.order_id == order.id)
            items = list(db.scalars(items_stmt).all())
            for it in items:
                stock_stmt = select(Stock).where(
                    Stock.warehouse_id == order.warehouse_id,
                    Stock.product_id == it.product_id
                )
                stock = db.scalar(stock_stmt)
                if stock:
                    stock.quantity += it.quantity
                    stock.version = (stock.version or 1) + 1
                    stock.updated_at = now_utc
                else:
                    stock = Stock(
                        warehouse_id=order.warehouse_id,
                        product_id=it.product_id,
                        quantity=it.quantity,
                        version=1,
                        updated_at=now_utc,
                        reorder_threshold=0
                    )
                    db.add(stock)

                ledger = StockLedger(
                    warehouse_id=order.warehouse_id,
                    product_id=it.product_id,
                    user_id=user_id,
                    change_quantity=it.quantity,
                    reference_type=ReferenceType.CANCELLATION,
                    reference_id=order.id,
                    transaction_type=TransactionType.STOCK_IN,
                    notes=f"Order #{order.id} cancellation restock",
                    created_at=now_utc
                )
                db.add(ledger)
        else:
            # Release any active stock reservations
            res_stmt = select(Reservation).where(Reservation.order_id == order.id)
            reservations = list(db.scalars(res_stmt).all())
            for r in reservations:
                if r.status == 'RESERVED':
                    r.status = 'RELEASED'

        order.order_status = 'CANCELLED'

        cancellation = Cancellation(
            order_id=order.id,
            reason=reason,
            cancelled_by=user_id,
            created_at=now_utc,
            financial_ledger_id=refund_entry_id,
            status='CANCELLED'
        )
        db.add(cancellation)

        db.commit()
        db.refresh(cancellation)
        db.refresh(order)
        return cancellation
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
