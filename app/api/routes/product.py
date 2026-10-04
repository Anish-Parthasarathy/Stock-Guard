from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import ProductCreate, ProductUpdate, ProductResponse
from app.services.product import (
    product_create,
    product_get,
    product_list,
    product_update,
    product_delete
)
from app.api.deps import get_db

router = APIRouter()


@router.post('', response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=ProductResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_product_endpoint(product: ProductCreate, db: Session = Depends(get_db)):
    return product_create(product, db)


@router.get('', response_model=List[ProductResponse])
@router.get('/', response_model=List[ProductResponse], include_in_schema=False)
async def list_products_endpoint(db: Session = Depends(get_db)):
    return product_list(db)


@router.get('/{id}', response_model=ProductResponse)
async def get_product_endpoint(id: int, db: Session = Depends(get_db)):
    return product_get(id, db)


@router.put('/{id}', response_model=ProductResponse)
async def update_product_endpoint(id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    return product_update(id, product, db)


@router.delete('/{id}')
async def delete_product_endpoint(id: int, db: Session = Depends(get_db)):
    return product_delete(id, db)
