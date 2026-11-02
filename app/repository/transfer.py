from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, update, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import TransferCreate
from app.modules.module import (
    Transfer,
    TransferContains,
    TransferReceipt,
    Stock,
    StockLedger,
    ReferenceType,
    TransactionType
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_transfers(
    db: Session,
    source_warehouse_id: Optional[int] = None,
    destination_warehouse_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Transfer]:
    stmt = select(Transfer).order_by(Transfer.created_at.desc(), Transfer.id.desc())
    if source_warehouse_id is not None:
        stmt = stmt.where(Transfer.source_warehouse_id == source_warehouse_id)
    if destination_warehouse_id is not None:
        stmt = stmt.where(Transfer.destination_warehouse_id == destination_warehouse_id)
    if status and status.strip():
        stmt = stmt.where(func.upper(Transfer.status) == status.strip().upper())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_transfer_by_id(db: Session, transfer_id: int) -> Optional[Transfer]:
    stmt = select(Transfer).where(Transfer.id == transfer_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_transfer_items(db: Session, transfer_id: int) -> List[TransferContains]:
    stmt = select(TransferContains).where(TransferContains.transfer_id == transfer_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_transfer_item_by_id(db: Session, item_id: int) -> Optional[TransferContains]:
    stmt = select(TransferContains).where(TransferContains.id == item_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_transfer_receipts(db: Session, transfer_id: int) -> List[TransferReceipt]:
    stmt = select(TransferReceipt).where(TransferReceipt.transfer_id == transfer_id).order_by(TransferReceipt.arrived_at.desc())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_total_received_for_transfer_item(db: Session, transfer_contains_id: int) -> int:
    stmt = select(func.coalesce(func.sum(TransferReceipt.quantity_received), 0)).where(
        TransferReceipt.transfer_contains_id == transfer_contains_id
    )
    try:
        return db.scalar(stmt) or 0
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def dispatch_transfer_atomic(
    db: Session,
    transfer_data: TransferCreate,
    user_id: int
) -> Transfer:
    """
    Executes intra-warehouse dispatch as a single atomic transaction:
    1. Creates Transfer header in 'IN_TRANSIT' status
    2. Inserts TransferContains line items in 'DISPATCHED' status
    3. Permanently deducts inventory from source warehouse Stock with version increment
    4. Appends StockLedger audit entries (STOCK_OUT, reference_type='TRANSFER')
    """
    now_utc = datetime.now(timezone.utc)
    try:
        transfer = Transfer(
            source_warehouse_id=transfer_data.source_warehouse_id,
            destination_warehouse_id=transfer_data.destination_warehouse_id,
            initiated_by=user_id,
            transport_mode=transfer_data.transport_mode,
            status='IN_TRANSIT',
            dispatched_at=now_utc,
            created_at=now_utc,
            expected_completion=transfer_data.expected_completion
        )
        db.add(transfer)
        db.flush()

        # Sort line items by product_id ASC for deterministic lock ordering
        sorted_items = sorted(transfer_data.items, key=lambda it: it.product_id)
        for item_data in sorted_items:
            line_item = TransferContains(
                transfer_id=transfer.id,
                product_id=item_data.product_id,
                quantity_dispatched=item_data.quantity_dispatched,
                status='DISPATCHED',
                dispatched_at=now_utc
            )
            db.add(line_item)

            # Atomic SQL deduction at source warehouse
            update_stmt = (
                update(Stock)
                .where(
                    Stock.warehouse_id == transfer_data.source_warehouse_id,
                    Stock.product_id == item_data.product_id,
                    Stock.quantity >= item_data.quantity_dispatched
                )
                .values(
                    quantity=Stock.quantity - item_data.quantity_dispatched,
                    version=Stock.version + 1,
                    updated_at=now_utc
                )
                .returning(Stock)
            )
            res = db.execute(update_stmt, execution_options={"populate_existing": True})
            updated_stock = res.scalar_one_or_none()
            if updated_stock is None:
                raise ValueError(
                    f"Insufficient stock for product {item_data.product_id} at source warehouse {transfer_data.source_warehouse_id}"
                )

            # Write stock audit ledger directly from authoritative returned stock
            ledger_entry = StockLedger(
                warehouse_id=updated_stock.warehouse_id,
                product_id=updated_stock.product_id,
                user_id=user_id,
                change_quantity=item_data.quantity_dispatched,
                reference_type=ReferenceType.TRANSFER,
                reference_id=transfer.id,
                transaction_type=TransactionType.STOCK_OUT,
                notes=f"Transfer #{transfer.id} dispatched to Warehouse #{transfer_data.destination_warehouse_id}",
                created_at=now_utc
            )
            db.add(ledger_entry)

        db.commit()
        db.refresh(transfer)
        return transfer
    except (IntegrityError, ValueError):
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def receive_transfer_item_atomic(
    db: Session,
    transfer: Transfer,
    item: TransferContains,
    quantity_received: int,
    receipt_status: str,
    user_id: int
) -> Tuple[TransferReceipt, Stock]:
    """
    Executes inbound transfer receipt as a single atomic transaction:
    1. Creates TransferReceipt record
    2. Updates line item TransferContains.status
    3. Updates Transfer.status (PARTIALLY_RECEIVED or COMPLETED)
    4. Increments destination warehouse Stock (or initializes stock record)
    5. Appends StockLedger audit entry (STOCK_IN, reference_type='TRANSFER')
    """
    now_utc = datetime.now(timezone.utc)
    try:
        # Lock Transfer record with FOR UPDATE to eliminate status transition race conditions
        transfer = db.scalar(
            select(Transfer).where(Transfer.id == transfer.id).with_for_update()
        )
        receipt = TransferReceipt(
            transfer_id=transfer.id,
            transfer_contains_id=item.id,
            product_id=item.product_id,
            quantity_received=quantity_received,
            received_by=user_id,
            arrived_at=now_utc,
            status=receipt_status
        )
        db.add(receipt)
        db.flush()

        # Update item status
        total_received = select_total_received_for_transfer_item(db, item.id)
        if total_received >= item.quantity_dispatched:
            item.status = 'COMPLETED'
        else:
            item.status = 'PARTIALLY_RECEIVED'

        # Check all items in this transfer
        all_items = select_transfer_items(db, transfer.id)
        all_completed = True
        for line in all_items:
            line_status = item.status if line.id == item.id else line.status
            if line_status != 'COMPLETED':
                all_completed = False
                break

        if all_completed:
            transfer.status = 'COMPLETED'
        else:
            transfer.status = 'PARTIALLY_RECEIVED'

        # Atomic PostgreSQL upsert targeting uq_stock_warehouse_product
        upsert_stmt = (
            pg_insert(Stock)
            .values(
                warehouse_id=transfer.destination_warehouse_id,
                product_id=item.product_id,
                quantity=quantity_received,
                version=1,
                updated_at=func.now(),
                reorder_threshold=0
            )
            .on_conflict_do_update(
                constraint="uq_stock_warehouse_product",
                set_={
                    "quantity": Stock.quantity + quantity_received,
                    "version": Stock.version + 1,
                    "updated_at": func.now()
                }
            )
            .returning(Stock)
        )
        res = db.execute(upsert_stmt, execution_options={"populate_existing": True})
        dest_stock = res.scalar_one()

        # Audit ledger at destination warehouse using authoritative returned stock
        ledger_entry = StockLedger(
            warehouse_id=dest_stock.warehouse_id,
            product_id=dest_stock.product_id,
            user_id=user_id,
            change_quantity=quantity_received,
            reference_type=ReferenceType.TRANSFER,
            reference_id=transfer.id,
            transaction_type=TransactionType.STOCK_IN,
            notes=f"Transfer #{transfer.id} received from Warehouse #{transfer.source_warehouse_id}",
            created_at=now_utc
        )
        db.add(ledger_entry)

        db.commit()
        db.refresh(receipt)
        db.refresh(item)
        db.refresh(transfer)
        db.refresh(dest_stock)
        return receipt, dest_stock
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
