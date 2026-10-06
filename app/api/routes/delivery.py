from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    DeliveryCreate,
    DeliveryStatusUpdate,
    DeliveryResponse
)
from app.services.delivery import (
    delivery_schedule,
    delivery_list,
    delivery_get,
    delivery_update_status_service
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=DeliveryResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def schedule_delivery_endpoint(
    delivery_data: DeliveryCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return delivery_schedule(delivery_data, db)


@router.get('', response_model=List[DeliveryResponse])
@router.get('/', response_model=List[DeliveryResponse], include_in_schema=False)
async def list_deliveries_endpoint(
    order_id: Optional[int] = None,
    agent_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return delivery_list(db, order_id=order_id, agent_id=agent_id, status_filter=status)


@router.get('/{id}', response_model=DeliveryResponse)
async def get_delivery_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return delivery_get(id, db)


@router.patch('/{id}/status', response_model=DeliveryResponse)
async def update_delivery_status_endpoint(
    id: int,
    status_data: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return delivery_update_status_service(id, status_data, db)
