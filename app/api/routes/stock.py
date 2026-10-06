from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    StockCreate,
    StockResponse,
    StockAdjustmentCreate,
    StockLedgerResponse
)
from app.services.stock import (
    stock_create,
    stock_get,
    stock_list,
    stock_adjust,
    stock_ledger_list
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=StockResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=StockResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_stock_endpoint(
    stock: StockCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    # Pass the email from the JWT so the service can resolve the users.id
    return stock_create(stock, db, user_email=user.get("email"))


@router.get('', response_model=List[StockResponse])
@router.get('/', response_model=List[StockResponse], include_in_schema=False)
async def list_stock_endpoint(
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    low_stock: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return stock_list(db, warehouse_id=warehouse_id, product_id=product_id, low_stock=low_stock)


@router.post('/adjust', response_model=StockResponse)
async def adjust_stock_endpoint(
    adjustment: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return stock_adjust(adjustment, db, user_email=user.get("email"))


@router.get('/ledger', response_model=List[StockLedgerResponse])
async def list_stock_ledger_endpoint(
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return stock_ledger_list(db, warehouse_id=warehouse_id, product_id=product_id)


@router.get('/{warehouse_id}/{product_id}', response_model=StockResponse)
async def get_stock_endpoint(
    warehouse_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return stock_get(warehouse_id, product_id, db)
