from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    OrderCreate,
    OrderResponse,
    PaymentCreate,
    FinancialLedgerResponse,
    OrderCancelCreate,
    CancellationResponse
)
from app.services.order import (
    order_create_and_reserve,
    order_list,
    order_get,
    order_process_payment,
    order_release_reservation
)
from app.services.cancellation import order_cancel
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=OrderResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_order_endpoint(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_create_and_reserve(order_data, db)


@router.get('', response_model=List[OrderResponse])
@router.get('/', response_model=List[OrderResponse], include_in_schema=False)
async def list_orders_endpoint(
    warehouse_id: Optional[int] = None,
    order_status: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_list(
        db,
        warehouse_id=warehouse_id,
        order_status=order_status,
        payment_status=payment_status
    )


@router.get('/{id}', response_model=OrderResponse)
async def get_order_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_get(id, db)


@router.post('/{id}/payments', response_model=FinancialLedgerResponse, status_code=status.HTTP_201_CREATED)
async def process_order_payment_endpoint(
    id: int,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_process_payment(id, payment_data, db, user_email=user.get("email"))


@router.post('/{id}/release-reservation', response_model=OrderResponse)
async def release_order_reservation_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_release_reservation(id, db)


@router.post('/{id}/cancel', response_model=CancellationResponse)
async def cancel_order_endpoint(
    id: int,
    cancel_data: OrderCancelCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return order_cancel(id, cancel_data, db, user_email=user.get("email"))

