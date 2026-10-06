from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    TransferCreate,
    TransferResponse,
    TransferReceiptCreate,
    TransferReceiptResponse
)
from app.services.transfer import (
    transfer_dispatch,
    transfer_list,
    transfer_get,
    transfer_receive_item
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=TransferResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def dispatch_transfer_endpoint(
    transfer_data: TransferCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return transfer_dispatch(transfer_data, db, user_email=user.get("email"))


@router.get('', response_model=List[TransferResponse])
@router.get('/', response_model=List[TransferResponse], include_in_schema=False)
async def list_transfers_endpoint(
    source_warehouse_id: Optional[int] = None,
    destination_warehouse_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return transfer_list(
        db,
        source_warehouse_id=source_warehouse_id,
        destination_warehouse_id=destination_warehouse_id,
        status_filter=status
    )


@router.get('/{id}', response_model=TransferResponse)
async def get_transfer_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return transfer_get(id, db)


@router.post('/{id}/receive', response_model=TransferReceiptResponse, status_code=status.HTTP_201_CREATED)
async def receive_transfer_item_endpoint(
    id: int,
    receipt_data: TransferReceiptCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return transfer_receive_item(id, receipt_data, db, user_email=user.get("email"))
