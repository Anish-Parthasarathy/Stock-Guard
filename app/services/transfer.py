from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    TransferCreate,
    TransferResponse,
    TransferItemResponse,
    TransferReceiptResponse,
    TransferReceiptCreate
)
from app.repository.transfer import (
    select_transfers,
    select_transfer_by_id,
    select_transfer_items,
    select_transfer_item_by_id,
    select_transfer_receipts,
    select_total_received_for_transfer_item,
    dispatch_transfer_atomic,
    receive_transfer_item_atomic
)
from app.repository.stock import (
    select_warehouse_by_id,
    select_product_by_id,
    select_stock_by_warehouse_product,
    select_user_by_email
)
from app.repository.order import select_active_reservations_quantity
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def _build_transfer_response(db: Session, transfer) -> TransferResponse:
    items = select_transfer_items(db, transfer.id)
    receipts = select_transfer_receipts(db, transfer.id)
    return TransferResponse(
        id=transfer.id,
        source_warehouse_id=transfer.source_warehouse_id,
        destination_warehouse_id=transfer.destination_warehouse_id,
        initiated_by=transfer.initiated_by,
        transport_mode=transfer.transport_mode,
        status=transfer.status,
        dispatched_at=transfer.dispatched_at,
        created_at=transfer.created_at,
        expected_completion=transfer.expected_completion,
        items=[TransferItemResponse.model_validate(it, from_attributes=True) for it in items],
        receipts=[TransferReceiptResponse.model_validate(rc, from_attributes=True) for rc in receipts]
    )


def transfer_dispatch(
    transfer_data: TransferCreate,
    db: Session,
    user_email: Optional[str]
) -> TransferResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to dispatch transfer"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    if transfer_data.source_warehouse_id == transfer_data.destination_warehouse_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and destination warehouses cannot be the same"
        )

    src = select_warehouse_by_id(db, transfer_data.source_warehouse_id)
    if not src:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source warehouse with ID {transfer_data.source_warehouse_id} not found"
        )

    dest = select_warehouse_by_id(db, transfer_data.destination_warehouse_id)
    if not dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination warehouse with ID {transfer_data.destination_warehouse_id} not found"
        )

    exp_comp = transfer_data.expected_completion
    if exp_comp.tzinfo is None:
        from datetime import timezone as tz
        exp_comp = exp_comp.replace(tzinfo=tz.utc)
    from datetime import datetime as dt, timezone as tz
    if exp_comp <= dt.now(tz.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="expected_completion must be in the future"
        )

    product_ids = [item.product_id for item in transfer_data.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate product_id found in transfer items"
        )

    for item in transfer_data.items:
        prod = select_product_by_id(db, item.product_id)
        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} not found"
            )

        stock = select_stock_by_warehouse_product(db, transfer_data.source_warehouse_id, item.product_id)
        if not stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No stock record exists for Product {item.product_id} in source Warehouse {transfer_data.source_warehouse_id}"
            )

        active_reserved = select_active_reservations_quantity(db, transfer_data.source_warehouse_id, item.product_id)
        available = stock.quantity - active_reserved
        if available < item.quantity_dispatched:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient available stock for Product {item.product_id} at source warehouse. Available: {available}, requested: {item.quantity_dispatched}"
            )

    try:
        new_transfer = dispatch_transfer_atomic(db, transfer_data, user.id)
        return _build_transfer_response(db, new_transfer)
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


def transfer_list(
    db: Session,
    source_warehouse_id: Optional[int] = None,
    destination_warehouse_id: Optional[int] = None,
    status_filter: Optional[str] = None
) -> List[TransferResponse]:
    try:
        transfers = select_transfers(
            db,
            source_warehouse_id=source_warehouse_id,
            destination_warehouse_id=destination_warehouse_id,
            status=status_filter
        )
        return [_build_transfer_response(db, t) for t in transfers]
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


def transfer_get(transfer_id: int, db: Session) -> TransferResponse:
    transfer = select_transfer_by_id(db, transfer_id)
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer with ID {transfer_id} not found"
        )
    return _build_transfer_response(db, transfer)


def transfer_receive_item(
    transfer_id: int,
    receipt_data: TransferReceiptCreate,
    db: Session,
    user_email: Optional[str]
) -> TransferReceiptResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to receive transfer items"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    transfer = select_transfer_by_id(db, transfer_id)
    if not transfer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer with ID {transfer_id} not found"
        )

    if transfer.status not in ['IN_TRANSIT', 'PARTIALLY_RECEIVED']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot receive items for transfer in '{transfer.status}' status"
        )

    item = select_transfer_item_by_id(db, receipt_data.transfer_contains_id)
    if not item or item.transfer_id != transfer.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer item with ID {receipt_data.transfer_contains_id} does not belong to Transfer {transfer_id}"
        )

    already_received = select_total_received_for_transfer_item(db, item.id)
    remaining = item.quantity_dispatched - already_received
    if remaining <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer item {item.id} has already been fully received"
        )

    if receipt_data.quantity_received > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Received quantity ({receipt_data.quantity_received}) exceeds remaining dispatched quantity ({remaining})"
        )

    try:
        receipt, _ = receive_transfer_item_atomic(
            db=db,
            transfer=transfer,
            item=item,
            quantity_received=receipt_data.quantity_received,
            receipt_status=receipt_data.status,
            user_id=user.id
        )
        return TransferReceiptResponse.model_validate(receipt, from_attributes=True)
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
