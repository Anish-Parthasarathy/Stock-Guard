import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import ReturnCreate, ReturnReceiptCreate
from app.modules.module import (
    Return,
    ReturnContains,
    ReturnReceipt,
    Stock,
    StockLedger,
    FinancialLedger,
    ReferenceType,
    TransactionType
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_returns(
    db: Session,
    order_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Return]:
    stmt = select(Return).order_by(Return.created_at.desc(), Return.id.desc())
    if order_id is not None:
        stmt = stmt.where(Return.order_id == order_id)
    if status and status.strip():
        stmt = stmt.where(func.upper(Return.status) == status.strip().upper())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_return_by_id(db: Session, return_id: int) -> Optional[Return]:
    stmt = select(Return).where(Return.id == return_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_return_items(db: Session, return_id: int) -> List[ReturnContains]:
    stmt = select(ReturnContains).where(ReturnContains.return_id == return_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_return_item_by_id(db: Session, item_id: int) -> Optional[ReturnContains]:
    stmt = select(ReturnContains).where(ReturnContains.id == item_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_return_receipts(db: Session, return_id: int) -> List[ReturnReceipt]:
    stmt = select(ReturnReceipt).where(ReturnReceipt.return_id == return_id).order_by(ReturnReceipt.received_at.desc())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_total_received_for_return_item(db: Session, return_contains_id: int) -> int:
    stmt = select(func.coalesce(func.sum(ReturnReceipt.quantity_received), 0)).where(
        ReturnReceipt.return_contains_id == return_contains_id
    )
    try:
        return db.scalar(stmt) or 0
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_return_with_items(db: Session, return_data: ReturnCreate) -> Return:
    now_utc = datetime.now(timezone.utc)
    try:
        return_record = Return(
            order_id=return_data.order_id,
            financial_ledger_id=None,
            reason=return_data.reason,
            status='REQUESTED',
            created_at=now_utc,
            return_type=return_data.return_type.upper(),
            replacement_order_id=None
        )
        db.add(return_record)
        db.flush()

        for it in return_data.items:
            line = ReturnContains(
                return_id=return_record.id,
                order_contains_id=it.order_contains_id,
                product_id=it.product_id,
                warehouse_id=it.warehouse_id,
                quantity_expected=it.quantity_expected,
                return_unit_price=it.return_unit_price,
                status='PENDING'
            )
            db.add(line)

        db.commit()
        db.refresh(return_record)
        return return_record
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def receive_return_item_atomic(
    db: Session,
    return_record: Return,
    item: ReturnContains,
    receipt_data: ReturnReceiptCreate,
    user_id: int,
    original_payment: Optional[FinancialLedger] = None
) -> Tuple[ReturnReceipt, Return]:
    """
    Executes return receipt processing as a single atomic transaction:
    1. Creates ReturnReceipt record
    2. Updates line item ReturnContains status
    3. Updates Return header status (PARTIALLY_RECEIVED or COMPLETED)
    4. If restocked, updates warehouse inventory and logs StockLedger (STOCK_IN, reference_type='RETURN')
    5. If all items received and return_type is REFUND, writes refund FinancialLedger
    """
    now_utc = datetime.now(timezone.utc)
    try:
        receipt = ReturnReceipt(
            return_id=return_record.id,
            return_contains_id=item.id,
            product_id=item.product_id,
            quantity_received=receipt_data.quantity_received,
            condition_status=receipt_data.condition_status.upper(),
            condition_notes=receipt_data.condition_notes,
            status=receipt_data.status.upper(),
            received_by=user_id,
            received_at=now_utc
        )
        db.add(receipt)
        db.flush()

        # Update item status
        total_rcvd = select_total_received_for_return_item(db, item.id)
        if total_rcvd >= item.quantity_expected:
            item.status = 'RECEIVED'
        else:
            item.status = 'PARTIALLY_RECEIVED'

        # Update return status
        all_items = select_return_items(db, return_record.id)
        all_completed = True
        for line in all_items:
            line_status = item.status if line.id == item.id else line.status
            if line_status != 'RECEIVED':
                all_completed = False
                break

        if all_completed:
            return_record.status = 'COMPLETED'
        else:
            return_record.status = 'PARTIALLY_RECEIVED'

        # If restocked into warehouse inventory
        if receipt_data.status.upper() == 'RESTOCKED' or receipt_data.condition_status.upper() == 'GOOD':
            stock_stmt = select(Stock).where(
                Stock.warehouse_id == item.warehouse_id,
                Stock.product_id == item.product_id
            )
            stock = db.scalar(stock_stmt)
            if stock:
                stock.quantity += receipt_data.quantity_received
                stock.version = (stock.version or 1) + 1
                stock.updated_at = now_utc
            else:
                stock = Stock(
                    warehouse_id=item.warehouse_id,
                    product_id=item.product_id,
                    quantity=receipt_data.quantity_received,
                    version=1,
                    updated_at=now_utc,
                    reorder_threshold=0
                )
                db.add(stock)

            ledger = StockLedger(
                warehouse_id=item.warehouse_id,
                product_id=item.product_id,
                user_id=user_id,
                change_quantity=receipt_data.quantity_received,
                reference_type=ReferenceType.RETURN,
                reference_id=return_record.id,
                transaction_type=TransactionType.STOCK_IN,
                notes=f"Return #{return_record.id} goods receipt ({receipt_data.condition_status})",
                created_at=now_utc
            )
            db.add(ledger)

        # If completed refund and refund not yet issued
        if (
            return_record.status == 'COMPLETED'
            and return_record.return_type == 'REFUND'
            and return_record.order_id
            and return_record.financial_ledger_id is None
        ):
            refund_amount = sum(it.quantity_expected * float(it.return_unit_price) for it in all_items)
            pay_mode = original_payment.payment_mode if original_payment else "REFUND"
            parent_id = original_payment.id if original_payment else None
            refund_entry = FinancialLedger(
                order_id=return_record.order_id,
                transaction_id=f"RFD-RET-{uuid.uuid4().hex[:10].upper()}",
                transaction_type='REFUND',
                amount=refund_amount,
                payment_mode=pay_mode,
                status='SUCCESS',
                idempotency_key=None,
                parent_transaction_id=parent_id,
                created_at=now_utc
            )
            db.add(refund_entry)
            db.flush()
            return_record.financial_ledger_id = refund_entry.id

        db.commit()
        db.refresh(receipt)
        db.refresh(item)
        db.refresh(return_record)
        return receipt, return_record
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
