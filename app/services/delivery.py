from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import DeliveryCreate, DeliveryStatusUpdate, DeliveryResponse
from app.repository.delivery import (
    select_deliveries,
    select_delivery_by_id,
    insert_delivery,
    update_delivery_status
)
from app.repository.order import select_order_by_id
from app.repository.stock import select_user_by_id
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def delivery_schedule(delivery_data: DeliveryCreate, db: Session) -> DeliveryResponse:
    order = select_order_by_id(db, delivery_data.order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {delivery_data.order_id} not found"
        )

    if order.order_status == 'CANCELLED':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule delivery for a cancelled order"
        )

    user = select_user_by_id(db, delivery_data.agent_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery agent with User ID {delivery_data.agent_id} not found"
        )

    sched = delivery_data.scheduled_at
    from datetime import datetime as dt, timezone as tz
    if sched.tzinfo is None:
        sched = sched.replace(tzinfo=tz.utc)
    if sched < dt.now(tz.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_at cannot be in the past"
        )

    try:
        new_delivery = insert_delivery(db, delivery_data)
        return DeliveryResponse.model_validate(new_delivery, from_attributes=True)
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


def delivery_list(
    db: Session,
    order_id: Optional[int] = None,
    agent_id: Optional[int] = None,
    status_filter: Optional[str] = None
) -> List[DeliveryResponse]:
    try:
        records = select_deliveries(db, order_id=order_id, agent_id=agent_id, status=status_filter)
        return [DeliveryResponse.model_validate(d, from_attributes=True) for d in records]
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


def delivery_get(delivery_id: int, db: Session) -> DeliveryResponse:
    delivery = select_delivery_by_id(db, delivery_id)
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery with ID {delivery_id} not found"
        )
    return DeliveryResponse.model_validate(delivery, from_attributes=True)


def delivery_update_status_service(
    delivery_id: int,
    status_data: DeliveryStatusUpdate,
    db: Session
) -> DeliveryResponse:
    delivery = select_delivery_by_id(db, delivery_id)
    if not delivery:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery with ID {delivery_id} not found"
        )

    valid_statuses = ['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']
    new_status = status_data.status.upper()
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_data.status}'. Must be one of: {valid_statuses}"
        )

    try:
        updated_delivery = update_delivery_status(
            db,
            delivery,
            new_status=new_status,
            delivered_to=status_data.delivered_to
        )
        return DeliveryResponse.model_validate(updated_delivery, from_attributes=True)
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
