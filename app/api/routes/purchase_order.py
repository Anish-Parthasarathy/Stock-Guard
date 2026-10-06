from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderApprovalUpdate,
    PurchaseOrderStatusUpdate,
    PurchaseOrderReceiptCreate,
    PurchaseOrderReceiptResponse
)
from app.services.purchase_order import (
    purchase_order_create,
    purchase_order_list,
    purchase_order_get,
    purchase_order_update_approval,
    purchase_order_update_status,
    purchase_order_receive_item
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_purchase_order_endpoint(
    po_data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_create(po_data, db, user_email=user.get("email"))


@router.get('', response_model=List[PurchaseOrderResponse])
@router.get('/', response_model=List[PurchaseOrderResponse], include_in_schema=False)
async def list_purchase_orders_endpoint(
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    approved_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_list(
        db,
        supplier_id=supplier_id,
        status_filter=status,
        approved_status=approved_status
    )


@router.get('/{id}', response_model=PurchaseOrderResponse)
async def get_purchase_order_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_get(id, db)


@router.patch('/{id}/approval', response_model=PurchaseOrderResponse)
async def update_po_approval_endpoint(
    id: int,
    approval_data: PurchaseOrderApprovalUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_update_approval(id, approval_data, db, user_email=user.get("email"))


@router.patch('/{id}/status', response_model=PurchaseOrderResponse)
async def update_po_status_endpoint(
    id: int,
    status_data: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_update_status(id, status_data, db)


@router.post('/{id}/receive', response_model=PurchaseOrderReceiptResponse, status_code=status.HTTP_201_CREATED)
async def receive_po_item_endpoint(
    id: int,
    receipt_data: PurchaseOrderReceiptCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return purchase_order_receive_item(id, receipt_data, db, user_email=user.get("email"))
