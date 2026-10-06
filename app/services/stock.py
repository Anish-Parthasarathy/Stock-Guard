from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import StockCreate, StockAdjustmentCreate
from app.repository.stock import (
    select_stock_by_warehouse_product,
    select_stocks,
    select_warehouse_by_id,
    select_product_by_id,
    select_user_by_email,
    insert_stock,
    adjust_stock,
    select_stock_ledgers
)
from app.modules.module import TransactionType
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def _resolve_user_id(db: Session, email: Optional[str]) -> Optional[int]:
    """Look up the users.id from the email embedded in the JWT token."""
    if not email:
        return None
    user = select_user_by_email(db, email)
    return user.id if user else None


def stock_create(stock_data: StockCreate, db: Session, user_email: Optional[str] = None):
    warehouse = select_warehouse_by_id(db, stock_data.warehouse_id)
    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {stock_data.warehouse_id} not found"
        )

    product = select_product_by_id(db, stock_data.product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {stock_data.product_id} not found"
        )

    existing_stock = select_stock_by_warehouse_product(db, stock_data.warehouse_id, stock_data.product_id)
    if existing_stock is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stock for warehouse {stock_data.warehouse_id} and product {stock_data.product_id} already exists"
        )

    # Resolve user_id from email for the audit ledger entry.
    # If no user is authenticated, a zero-quantity stock record can still be created
    # without a ledger entry (insert_stock only writes ledger when quantity > 0 and user_id is not None).
    user_id = _resolve_user_id(db, user_email)

    try:
        return insert_stock(db, stock_data, user_id=user_id)
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


def stock_get(warehouse_id: int, product_id: int, db: Session):
    stock = select_stock_by_warehouse_product(db, warehouse_id, product_id)
    if stock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock record for warehouse {warehouse_id} and product {product_id} not found"
        )
    return stock


def stock_list(
    db: Session,
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None,
    low_stock: Optional[bool] = None
) -> List:
    try:
        return select_stocks(db, warehouse_id=warehouse_id, product_id=product_id, low_stock=low_stock)
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


def stock_adjust(adj_data: StockAdjustmentCreate, db: Session, user_email: Optional[str] = None):
    # Resolve authenticated user - required for the ledger audit trail
    user_id = _resolve_user_id(db, user_email)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to adjust stock"
        )

    warehouse = select_warehouse_by_id(db, adj_data.warehouse_id)
    if warehouse is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {adj_data.warehouse_id} not found"
        )

    product = select_product_by_id(db, adj_data.product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {adj_data.product_id} not found"
        )

    current_stock = select_stock_by_warehouse_product(db, adj_data.warehouse_id, adj_data.product_id)
    if current_stock is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock record for warehouse {adj_data.warehouse_id} and product {adj_data.product_id} not found"
        )

    # Optimistic locking: if the caller supplies expected_version, verify it matches
    if adj_data.expected_version is not None and current_stock.version != adj_data.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Concurrency conflict: stock version is {current_stock.version}, expected {adj_data.expected_version}"
        )

    # Resolve and validate adjustment type
    adj_type = adj_data.adjustment_type
    if adj_type == TransactionType.ADJUSTMENT_DOWN.value or adj_type == TransactionType.ADJUSTMENT_DOWN:
        if current_stock.quantity < adj_data.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock: current quantity is {current_stock.quantity}, cannot reduce by {adj_data.quantity}"
            )
        new_quantity = current_stock.quantity - adj_data.quantity
        tx_type = TransactionType.ADJUSTMENT_DOWN
    elif adj_type == TransactionType.ADJUSTMENT_UP.value or adj_type == TransactionType.ADJUSTMENT_UP:
        new_quantity = current_stock.quantity + adj_data.quantity
        tx_type = TransactionType.ADJUSTMENT_UP
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid adjustment_type '{adj_data.adjustment_type}'. Must be ADJUSTMENT_UP or ADJUSTMENT_DOWN"
        )

    try:
        # Pass the already-fetched stock object to avoid a second DB read
        # and the race condition between the check above and the write below.
        return adjust_stock(
            db=db,
            stock=current_stock,
            tx_type=tx_type,
            new_quantity=new_quantity,
            change_quantity=adj_data.quantity,
            user_id=user_id,
            notes=adj_data.notes
        )
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


def stock_ledger_list(
    db: Session,
    warehouse_id: Optional[int] = None,
    product_id: Optional[int] = None
) -> List:
    try:
        return select_stock_ledgers(db, warehouse_id=warehouse_id, product_id=product_id)
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
