from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierProductCreate,
    SupplierProductResponse
)
from app.services.supplier import (
    supplier_create,
    supplier_list,
    supplier_get,
    supplier_update,
    supplier_delete,
    supplier_product_add,
    supplier_product_list,
    supplier_product_remove
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.post('', response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=SupplierResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_supplier_endpoint(
    supplier: SupplierCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_create(supplier, db)


@router.get('', response_model=List[SupplierResponse])
@router.get('/', response_model=List[SupplierResponse], include_in_schema=False)
async def list_suppliers_endpoint(
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_list(db)


@router.get('/{id}', response_model=SupplierResponse)
async def get_supplier_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_get(id, db)


@router.put('/{id}', response_model=SupplierResponse)
async def update_supplier_endpoint(
    id: int,
    supplier: SupplierUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_update(id, supplier, db)


@router.post('/{id}/products', response_model=SupplierProductResponse, status_code=status.HTTP_201_CREATED)
async def add_supplier_product_endpoint(
    id: int,
    sp_data: SupplierProductCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_product_add(id, sp_data, db)


@router.get('/{id}/products', response_model=List[SupplierProductResponse])
async def list_supplier_products_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_product_list(id, db)


@router.delete('/{id}')
async def delete_supplier_endpoint(
    id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_delete(id, db)


@router.delete('/{id}/products/{product_id}')
async def remove_supplier_product_endpoint(
    id: int,
    product_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    return supplier_product_remove(id, product_id, db)

