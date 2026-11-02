import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
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

            # Restock fulfilled items back to inventory in deterministic product_id ASC order
            items_stmt = select(OrderContains).where(OrderContains.order_id == order.id)
            items = list(db.scalars(items_stmt).all())
            sorted_items = sorted(items, key=lambda it: it.product_id)
            for it in sorted_items:
                upsert_stmt = (
                    pg_insert(Stock)
                    .values(
                        warehouse_id=order.warehouse_id,
                        product_id=it.product_id,
                        quantity=it.quantity,
                        version=1,
                        updated_at=func.now(),
                        reorder_threshold=0
                    )
                    .on_conflict_do_update(
                        constraint="uq_stock_warehouse_product",
                        set_={
                            "quantity": Stock.quantity + it.quantity,
                            "version": Stock.version + 1,
                            "updated_at": func.now()
                        }
                    )
                    .returning(Stock)
                )
                res = db.execute(upsert_stmt, execution_options={"populate_existing": True})
                stock = res.scalar_one()

                ledger = StockLedger(
                    warehouse_id=stock.warehouse_id,
                    product_id=stock.product_id,
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
            # Release any active stock reservations under row lock
            res_stmt = (
                select(Reservation)
                .where(Reservation.order_id == order.id)
                .with_for_update()
            )
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
    except OperationalError:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
