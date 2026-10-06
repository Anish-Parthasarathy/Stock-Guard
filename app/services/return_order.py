from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    ReturnCreate,
    ReturnResponse,
    ReturnItemResponse,
    ReturnReceiptResponse,
    ReturnReceiptCreate
)
from app.repository.return_order import (
    select_returns,
    select_return_by_id,
    select_return_items,
    select_return_item_by_id,
    select_return_receipts,
    select_total_received_for_return_item,
    insert_return_with_items,
    receive_return_item_atomic
)
from app.repository.order import select_order_by_id, select_order_items
from app.repository.stock import select_warehouse_by_id, select_product_by_id, select_user_by_email
from app.repository.financial_ledger import select_financial_ledgers
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def _build_return_response(db: Session, return_record) -> ReturnResponse:
    items = select_return_items(db, return_record.id)
    receipts = select_return_receipts(db, return_record.id)
    return ReturnResponse(
        id=return_record.id,
        order_id=return_record.order_id,
        financial_ledger_id=return_record.financial_ledger_id,
        reason=return_record.reason,
        status=return_record.status,
        created_at=return_record.created_at,
        return_type=return_record.return_type,
        replacement_order_id=return_record.replacement_order_id,
        items=[ReturnItemResponse.model_validate(it, from_attributes=True) for it in items],
        receipts=[ReturnReceiptResponse.model_validate(rc, from_attributes=True) for rc in receipts]
    )


def return_request(return_data: ReturnCreate, db: Session) -> ReturnResponse:
    order = select_order_by_id(db, return_data.order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {return_data.order_id} not found"
        )

    if order.order_status == 'CANCELLED':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot return items for a cancelled order"
        )

    product_ids = [it.product_id for it in return_data.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate product_id found in return items"
        )

    order_items = select_order_items(db, return_data.order_id)
    order_item_map = {it.id: it for it in order_items}

    for item in return_data.items:
        if item.order_contains_id not in order_item_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Line item {item.order_contains_id} does not belong to Order {return_data.order_id}"
            )
        order_line = order_item_map[item.order_contains_id]
        if item.product_id != order_line.product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product ID {item.product_id} does not match ordered product {order_line.product_id}"
            )
        if item.quantity_expected > order_line.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Return quantity ({item.quantity_expected}) exceeds ordered quantity ({order_line.quantity})"
            )

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
        new_return = insert_return_with_items(db, return_data)
        return _build_return_response(db, new_return)
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


def return_list(
    db: Session,
    order_id: Optional[int] = None,
    status_filter: Optional[str] = None
) -> List[ReturnResponse]:
    try:
        records = select_returns(db, order_id=order_id, status=status_filter)
        return [_build_return_response(db, r) for r in records]
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


def return_get(return_id: int, db: Session) -> ReturnResponse:
    return_record = select_return_by_id(db, return_id)
    if not return_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return record with ID {return_id} not found"
        )
    return _build_return_response(db, return_record)


def return_receive_item(
    return_id: int,
    receipt_data: ReturnReceiptCreate,
    db: Session,
    user_email: Optional[str]
) -> ReturnReceiptResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to receive return items"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    return_record = select_return_by_id(db, return_id)
    if not return_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return record with ID {return_id} not found"
        )

    if return_record.status in ['COMPLETED', 'REJECTED']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot receive items for a return in '{return_record.status}' status"
        )

    item = select_return_item_by_id(db, receipt_data.return_contains_id)
    if not item or item.return_id != return_record.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Return line item {receipt_data.return_contains_id} does not belong to Return {return_id}"
        )

    already_received = select_total_received_for_return_item(db, item.id)
    remaining = item.quantity_expected - already_received
    if remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Return item {item.id} has already been fully received"
        )

    if receipt_data.quantity_received > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Received quantity ({receipt_data.quantity_received}) exceeds remaining expected quantity ({remaining})"
        )

    # Find original payment if return type is refund
    original_payment = None
    if return_record.return_type == 'REFUND' and return_record.order_id:
        financial_records = select_financial_ledgers(db, order_id=return_record.order_id)
        for f in financial_records:
            if f.transaction_type == 'PAYMENT' and f.status == 'SUCCESS':
                original_payment = f
                break

    try:
        receipt, _ = receive_return_item_atomic(
            db=db,
            return_record=return_record,
            item=item,
            receipt_data=receipt_data,
            user_id=user.id,
            original_payment=original_payment
        )
        return ReturnReceiptResponse.model_validate(receipt, from_attributes=True)
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
