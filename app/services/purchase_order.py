from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderItemResponse,
    PurchaseOrderReceiptResponse,
    PurchaseOrderApprovalUpdate,
    PurchaseOrderStatusUpdate,
    PurchaseOrderReceiptCreate
)
from app.repository.purchase_order import (
    select_purchase_orders,
    select_purchase_order_by_id,
    select_po_items,
    select_po_item_by_id,
    select_po_receipts,
    select_total_received_for_item,
    insert_purchase_order_with_items,
    update_po_approval,
    update_po_status,
    receive_po_item_atomic
)
from app.repository.supplier import select_supplier_by_id
from app.repository.product import select_product_by_id
from app.repository.stock import select_warehouse_by_id, select_user_by_email
from app.modules.module import PurchaseOrderApprovalStatus, PurchaseOrderStatus
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def _build_po_response(db: Session, po) -> PurchaseOrderResponse:
    items = select_po_items(db, po.id)
    receipts = select_po_receipts(db, po.id)
    return PurchaseOrderResponse(
        id=po.id,
        supplier_id=po.supplier_id,
        created_by=po.created_by,
        is_auto_generated=po.is_auto_generated,
        created_at=po.created_at,
        approved_by=po.approved_by,
        approved_status=po.approved_status if isinstance(po.approved_status, str) else po.approved_status.value,
        status=po.status if isinstance(po.status, str) else po.status.value,
        items=[PurchaseOrderItemResponse.model_validate(it, from_attributes=True) for it in items],
        receipts=[PurchaseOrderReceiptResponse.model_validate(rc, from_attributes=True) for rc in receipts]
    )


def purchase_order_create(
    po_data: PurchaseOrderCreate,
    db: Session,
    user_email: Optional[str]
) -> PurchaseOrderResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to create a purchase order"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    supplier = select_supplier_by_id(db, po_data.supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {po_data.supplier_id} not found"
        )

    product_ids = [item.product_id for item in po_data.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate product_id found in purchase order items"
        )

    for item in po_data.items:
        prod = select_product_by_id(db, item.product_id)
        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} not found"
            )
        wh = select_warehouse_by_id(db, item.warehouse_id)
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {item.warehouse_id} not found"
            )

    try:
        new_po = insert_purchase_order_with_items(db, po_data, user.id)
        return _build_po_response(db, new_po)
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def purchase_order_list(
    db: Session,
    supplier_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    approved_status: Optional[str] = None
) -> List[PurchaseOrderResponse]:
    try:
        orders = select_purchase_orders(db, supplier_id, status_filter, approved_status)
        return [_build_po_response(db, po) for po in orders]
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def purchase_order_get(po_id: int, db: Session) -> PurchaseOrderResponse:
    po = select_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with ID {po_id} not found"
        )
    return _build_po_response(db, po)


def purchase_order_update_approval(
    po_id: int,
    approval_data: PurchaseOrderApprovalUpdate,
    db: Session,
    user_email: Optional[str]
) -> PurchaseOrderResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to approve/reject a purchase order"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    po = select_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with ID {po_id} not found"
        )

    current_status = po.status.value if hasattr(po.status, 'value') else str(po.status)
    if current_status in [
        PurchaseOrderStatus.PARTIALLY_RECEIVED.value,
        PurchaseOrderStatus.FULLY_RECEIVED.value,
        PurchaseOrderStatus.CLOSED.value
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change approval status for purchase order in '{current_status}' state"
        )

    valid_statuses = [s.value for s in PurchaseOrderApprovalStatus]
    if approval_data.approved_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid approved_status '{approval_data.approved_status}'. Must be one of: {valid_statuses}"
        )

    try:
        updated_po = update_po_approval(db, po, approval_data.approved_status, user.id)
        return _build_po_response(db, updated_po)
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def purchase_order_update_status(
    po_id: int,
    status_data: PurchaseOrderStatusUpdate,
    db: Session
) -> PurchaseOrderResponse:
    po = select_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with ID {po_id} not found"
        )

    curr_approved = po.approved_status.value if hasattr(po.approved_status, 'value') else str(po.approved_status)
    if curr_approved != PurchaseOrderApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update transit status of an unapproved purchase order"
        )

    curr_status = po.status.value if hasattr(po.status, 'value') else str(po.status)
    if curr_status == PurchaseOrderStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change status of a closed purchase order"
        )

    valid_statuses = [s.value for s in PurchaseOrderStatus]
    if status_data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_data.status}'. Must be one of: {valid_statuses}"
        )

    try:
        updated_po = update_po_status(db, po, status_data.status)
        return _build_po_response(db, updated_po)
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


def purchase_order_receive_item(
    po_id: int,
    receipt_data: PurchaseOrderReceiptCreate,
    db: Session,
    user_email: Optional[str]
) -> PurchaseOrderReceiptResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to receive purchase order items"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    po = select_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with ID {po_id} not found"
        )

    if po.approved_status != PurchaseOrderApprovalStatus.APPROVED.value and po.approved_status != PurchaseOrderApprovalStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot receive items for an unapproved purchase order"
        )

    if po.status == PurchaseOrderStatus.CLOSED.value or po.status == PurchaseOrderStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot receive items for a closed purchase order"
        )

    item = select_po_item_by_id(db, receipt_data.purchase_order_contains_id)
    if not item or item.purchase_order_id != po.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {receipt_data.purchase_order_contains_id} does not belong to Purchase Order {po_id}"
        )

    already_received = select_total_received_for_item(db, item.id)
    remaining = item.quantity_ordered - already_received
    if remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item {item.id} has already been fully received ({already_received}/{item.quantity_ordered})"
        )

    if receipt_data.quantity_received > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Received quantity ({receipt_data.quantity_received}) exceeds remaining ordered quantity ({remaining})"
        )

    try:
        receipt, _ = receive_po_item_atomic(
            db=db,
            po=po,
            item=item,
            quantity_received=receipt_data.quantity_received,
            condition_notes=receipt_data.condition_notes,
            user_id=user.id
        )
        return PurchaseOrderReceiptResponse.model_validate(receipt, from_attributes=True)
    except DATABASEINTEGRITYERROR as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except DATABASEOPERATIONALERROR as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except INTERNALDATABASEERROR as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
