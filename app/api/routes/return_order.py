from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    ReturnCreate,
    ReturnResponse,
    ReturnReceiptCreate,
    ReturnReceiptResponse
)
from app.services.return_order import (
    return_request,
    return_list,
    return_get,
    return_receive_item
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=ReturnResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_return_endpoint(
    return_data: ReturnCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return return_request(return_data, db)


@router.get('', response_model=List[ReturnResponse])
@router.get('/', response_model=List[ReturnResponse], include_in_schema=False)
async def list_returns_endpoint(
    order_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return return_list(db, order_id=order_id, status_filter=status)


@router.get('/{id}', response_model=ReturnResponse)
async def get_return_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return return_get(id, db)


@router.post('/{id}/receive', response_model=ReturnReceiptResponse, status_code=status.HTTP_201_CREATED)
async def receive_return_endpoint(
    id: int,
    receipt_data: ReturnReceiptCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return return_receive_item(id, receipt_data, db, user_email=user.get("email"))
