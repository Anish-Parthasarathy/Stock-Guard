from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import PurchaseOrderCreate
from app.modules.module import (
    PurchaseOrder,
    PurchaseOrderContains,
    PurchaseOrderReceipt,
    Stock,
    StockLedger,
    PurchaseOrderApprovalStatus,
    PurchaseOrderStatus,
    ReferenceType,
    TransactionType
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_purchase_orders(
    db: Session,
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    approved_status: Optional[str] = None
) -> List[PurchaseOrder]:
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc(), PurchaseOrder.id.desc())
    if supplier_id is not None:
        stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)
    if status is not None:
        stmt = stmt.where(PurchaseOrder.status == status)
    if approved_status is not None:
        stmt = stmt.where(PurchaseOrder.approved_status == approved_status)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_purchase_order_by_id(db: Session, po_id: int) -> Optional[PurchaseOrder]:
    stmt = select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_po_items(db: Session, po_id: int) -> List[PurchaseOrderContains]:
    stmt = select(PurchaseOrderContains).where(PurchaseOrderContains.purchase_order_id == po_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_po_item_by_id(db: Session, item_id: int) -> Optional[PurchaseOrderContains]:
    stmt = select(PurchaseOrderContains).where(PurchaseOrderContains.id == item_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_po_receipts(db: Session, po_id: int) -> List[PurchaseOrderReceipt]:
    stmt = select(PurchaseOrderReceipt).where(PurchaseOrderReceipt.purchase_order_id == po_id).order_by(PurchaseOrderReceipt.received_at.desc())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_total_received_for_item(db: Session, item_id: int) -> int:
    stmt = select(func.coalesce(func.sum(PurchaseOrderReceipt.quantity_received), 0)).where(
        PurchaseOrderReceipt.purchase_order_contains_id == item_id
    )
    try:
        return db.scalar(stmt) or 0
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_purchase_order_with_items(
    db: Session,
    po_data: PurchaseOrderCreate,
    created_by_user_id: int
) -> PurchaseOrder:
    try:
        new_po = PurchaseOrder(
            supplier_id=po_data.supplier_id,
            created_by=created_by_user_id,
            is_auto_generated=po_data.is_auto_generated,
            created_at=datetime.now(timezone.utc),
            approved_by=None,
            approved_status=PurchaseOrderApprovalStatus.PENDING_APPROVAL,
            status=PurchaseOrderStatus.NOT_ISSUED
        )
        db.add(new_po)
        db.flush()  # assign new_po.id

        for item_data in po_data.items:
            po_item = PurchaseOrderContains(
                purchase_order_id=new_po.id,
                product_id=item_data.product_id,
                warehouse_id=item_data.warehouse_id,
                quantity_ordered=item_data.quantity_ordered,
                unit_price=item_data.unit_price,
                expected_date=item_data.expected_date,
                status='PENDING'
            )
            db.add(po_item)

        db.commit()
        db.refresh(new_po)
        return new_po
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def update_po_approval(
    db: Session,
    po: PurchaseOrder,
    approved_status: str,
    approved_by_user_id: int
) -> PurchaseOrder:
    try:
        status_enum = (
            PurchaseOrderApprovalStatus(approved_status)
            if isinstance(approved_status, str) and approved_status in [s.value for s in PurchaseOrderApprovalStatus]
            else approved_status
        )
        po.approved_status = status_enum
        po.approved_by = approved_by_user_id

        curr_approved = po.approved_status.value if hasattr(po.approved_status, 'value') else str(po.approved_status)
        if curr_approved == PurchaseOrderApprovalStatus.APPROVED.value:
            po.status = PurchaseOrderStatus.ISSUED_TO_VENDOR
        elif curr_approved == PurchaseOrderApprovalStatus.REJECTED.value:
            po.status = PurchaseOrderStatus.CLOSED

        db.commit()
        db.refresh(po)
        return po
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def update_po_status(
    db: Session,
    po: PurchaseOrder,
    new_status: str
) -> PurchaseOrder:
    try:
        status_enum = (
            PurchaseOrderStatus(new_status)
            if isinstance(new_status, str) and new_status in [s.value for s in PurchaseOrderStatus]
            else new_status
        )
        po.status = status_enum
        db.commit()
        db.refresh(po)
        return po
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def receive_po_item_atomic(
    db: Session,
    po: PurchaseOrder,
    item: PurchaseOrderContains,
    quantity_received: int,
    condition_notes: Optional[str],
    user_id: int
) -> Tuple[PurchaseOrderReceipt, Stock]:
    """
    Executes an inbound goods receipt as a single atomic database transaction:
    1. Creates PurchaseOrderReceipt
    2. Updates line item PurchaseOrderContains.status
    3. Updates PurchaseOrder.status (PARTIALLY_RECEIVED or FULLY_RECEIVED)
    4. Increments Stock.quantity (or creates Stock if none exists)
    5. Records StockLedger audit entry with reference_type='PURCHASE_ORDER'
    """
    try:
        # 1. Create Receipt
        receipt = PurchaseOrderReceipt(
            purchase_order_id=po.id,
            purchase_order_contains_id=item.id,
            product_id=item.product_id,
            quantity_received=quantity_received,
            condition_notes=condition_notes,
            received_at=datetime.now(timezone.utc)
        )
        db.add(receipt)
        db.flush()

        # 2. Check total received for this item so far
        total_item_received = select_total_received_for_item(db, item.id)
        if total_item_received >= item.quantity_ordered:
            item.status = 'FULLY_RECEIVED'
        else:
            item.status = 'PARTIALLY_RECEIVED'

        # 3. Check all line items for this PO
        all_items = select_po_items(db, po.id)
        all_fully_received = True
        for line in all_items:
            line_status = item.status if line.id == item.id else line.status
            if line_status != 'FULLY_RECEIVED':
                all_fully_received = False
                break

        if all_fully_received:
            po.status = PurchaseOrderStatus.FULLY_RECEIVED
        else:
            po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED

        # 4. Increment Stock (or create stock if not present)
        stock_stmt = select(Stock).where(
            Stock.warehouse_id == item.warehouse_id,
            Stock.product_id == item.product_id
        )
        stock = db.scalar(stock_stmt)
        if stock is not None:
            stock.quantity += quantity_received
            stock.version = (stock.version or 1) + 1
            stock.updated_at = datetime.now(timezone.utc)
        else:
            stock = Stock(
                warehouse_id=item.warehouse_id,
                product_id=item.product_id,
                quantity=quantity_received,
                version=1,
                updated_at=datetime.now(timezone.utc),
                reorder_threshold=0
            )
            db.add(stock)

        # 5. Insert StockLedger audit entry
        ledger = StockLedger(
            warehouse_id=item.warehouse_id,
            product_id=item.product_id,
            user_id=user_id,
            change_quantity=quantity_received,
            reference_type=ReferenceType.PURCHASE_ORDER,
            reference_id=po.id,
            transaction_type=TransactionType.STOCK_IN,
            notes=f"PO #{po.id} receipt: {condition_notes or ''}",
            created_at=datetime.now(timezone.utc)
        )
        db.add(ledger)

        # Commit everything together
        db.commit()
        db.refresh(receipt)
        db.refresh(item)
        db.refresh(po)
        db.refresh(stock)
        return receipt, stock
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
