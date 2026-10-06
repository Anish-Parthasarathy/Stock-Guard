import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    OrderCreate,
    OrderResponse,
    OrderItemResponse,
    ReservationResponse,
    PaymentCreate,
    FinancialLedgerResponse
)
from app.repository.order import (
    select_orders,
    select_order_by_id,
    select_order_by_external_ref,
    select_order_items,
    select_order_reservations,
    select_active_reservations_quantity,
    insert_order_with_items_and_reservations,
    release_order_reservations
)
from app.repository.financial_ledger import (
    select_financial_by_idempotency_key,
    select_financial_by_transaction_id,
    select_financial_ledgers,
    fulfill_order_payment_atomic
)
from app.repository.stock import (
    select_warehouse_by_id,
    select_product_by_id,
    select_stock_by_warehouse_product,
    select_user_by_email
)
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def _build_order_response(db: Session, order) -> OrderResponse:
    items = select_order_items(db, order.id)
    reservations = select_order_reservations(db, order.id)
    return OrderResponse(
        id=order.id,
        warehouse_id=order.warehouse_id,
        external_reference_id=order.external_reference_id,
        order_status=order.order_status,
        payment_status=order.payment_status,
        total_amount=float(order.total_amount),
        created_at=order.created_at,
        items=[OrderItemResponse.model_validate(it, from_attributes=True) for it in items],
        reservations=[ReservationResponse.model_validate(r, from_attributes=True) for r in reservations]
    )


def order_create_and_reserve(order_data: OrderCreate, db: Session) -> OrderResponse:
    wh = select_warehouse_by_id(db, order_data.warehouse_id)
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {order_data.warehouse_id} not found"
        )

    existing_ref = select_order_by_external_ref(db, order_data.external_reference_id)
    if existing_ref:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order with external_reference_id '{order_data.external_reference_id}' already exists"
        )

    product_ids = [item.product_id for item in order_data.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate product_id found in order items"
        )

    # Validate each line item & inventory availability before creating holds
    total_amount = 0.0
    for item in order_data.items:
        prod = select_product_by_id(db, item.product_id)
        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {item.product_id} not found"
            )

        stock = select_stock_by_warehouse_product(db, order_data.warehouse_id, item.product_id)
        if not stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No stock record exists for Product {item.product_id} in Warehouse {order_data.warehouse_id}"
            )

        active_reserved = select_active_reservations_quantity(db, order_data.warehouse_id, item.product_id)
        available = stock.quantity - active_reserved
        if available < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient available stock for Product {item.product_id}. Available: {available}, requested: {item.quantity}"
            )

        total_amount += round(item.quantity * item.unit_price, 2)

    expire_at = datetime.now(timezone.utc) + timedelta(minutes=order_data.reservation_duration_minutes)

    try:
        new_order = insert_order_with_items_and_reservations(db, order_data, total_amount, expire_at)
        return _build_order_response(db, new_order)
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


def order_list(
    db: Session,
    warehouse_id: Optional[int] = None,
    order_status: Optional[str] = None,
    payment_status: Optional[str] = None
) -> List[OrderResponse]:
    try:
        orders = select_orders(db, warehouse_id, order_status, payment_status)
        return [_build_order_response(db, o) for o in orders]
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


def order_get(order_id: int, db: Session) -> OrderResponse:
    order = select_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found"
        )
    return _build_order_response(db, order)


def order_process_payment(
    order_id: int,
    payment_data: PaymentCreate,
    db: Session,
    user_email: Optional[str]
) -> FinancialLedgerResponse:
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to settle payment"
        )
    user = select_user_by_email(db, user_email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found"
        )

    order = select_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found"
        )

    if order.order_status == 'CANCELLED':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot process payment for a cancelled order"
        )

    if order.payment_status == 'PAID':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already paid"
        )

    order_total = round(float(order.total_amount), 2)
    if round(payment_data.amount, 2) < order_total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payment_data.amount}) is less than order total ({order_total})"
        )

    # Idempotency check: if key already exists, return existing transaction safely
    clean_idempotency_key = payment_data.idempotency_key.strip() if payment_data.idempotency_key and payment_data.idempotency_key.strip() else None
    if clean_idempotency_key:
        existing_txn = select_financial_by_idempotency_key(db, clean_idempotency_key)
        if existing_txn:
            return FinancialLedgerResponse.model_validate(existing_txn, from_attributes=True)

    items = select_order_items(db, order.id)
    reservations = select_order_reservations(db, order.id)

    # Verify inventory is sufficient to complete deduction
    for item in items:
        stock = select_stock_by_warehouse_product(db, order.warehouse_id, item.product_id)
        if not stock or stock.quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory in warehouse to fulfill Product {item.product_id}"
            )

    txn_id = payment_data.transaction_id or f"TXN-{uuid.uuid4().hex[:12].upper()}"
    existing_by_id = select_financial_by_transaction_id(db, txn_id)
    if existing_by_id:
        txn_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"

    try:
        financial_entry = fulfill_order_payment_atomic(
            db=db,
            order=order,
            items=items,
            reservations=reservations,
            txn_id=txn_id,
            amount=payment_data.amount,
            payment_mode=payment_data.payment_mode,
            idempotency_key=clean_idempotency_key,
            user_id=user.id
        )
        return FinancialLedgerResponse.model_validate(financial_entry, from_attributes=True)
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


def order_release_reservation(order_id: int, db: Session) -> OrderResponse:
    order = select_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found"
        )

    if order.payment_status == 'PAID':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot release reservations for an already paid order"
        )

    if order.order_status == 'CANCELLED':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is already cancelled"
        )

    try:
        released_order = release_order_reservations(db, order)
        return _build_order_response(db, released_order)
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


def financial_ledger_list(
    db: Session,
    order_id: Optional[int] = None
) -> List[FinancialLedgerResponse]:
    try:
        records = select_financial_ledgers(db, order_id)
        return [FinancialLedgerResponse.model_validate(r, from_attributes=True) for r in records]
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
