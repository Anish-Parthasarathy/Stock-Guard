from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryProductResponse,
    ProductResponse
)
from app.services.category import (
    category_create,
    category_get,
    category_list,
    category_update,
    category_delete,
    category_product_add,
    category_product_remove,
    category_product_list
)
from app.api.deps import get_db

router = APIRouter()


@router.post('', response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
@router.post('/', response_model=CategoryResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_category_endpoint(category: CategoryCreate, db: Session = Depends(get_db)):
    return category_create(category, db)


@router.get('', response_model=List[CategoryResponse])
@router.get('/', response_model=List[CategoryResponse], include_in_schema=False)
async def list_categories_endpoint(db: Session = Depends(get_db)):
    return category_list(db)


@router.get('/{id}', response_model=CategoryResponse)
async def get_category_endpoint(id: int, db: Session = Depends(get_db)):
    return category_get(id, db)


@router.put('/{id}', response_model=CategoryResponse)
async def update_category_endpoint(id: int, category: CategoryUpdate, db: Session = Depends(get_db)):
    return category_update(id, category, db)


@router.delete('/{id}')
async def delete_category_endpoint(id: int, db: Session = Depends(get_db)):
    return category_delete(id, db)


@router.post('/{category_id}/products/{product_id}', response_model=CategoryProductResponse, status_code=status.HTTP_201_CREATED)
async def assign_product_to_category_endpoint(category_id: int, product_id: int, db: Session = Depends(get_db)):
    return category_product_add(category_id, product_id, db)


@router.delete('/{category_id}/products/{product_id}')
async def remove_product_from_category_endpoint(category_id: int, product_id: int, db: Session = Depends(get_db)):
    return category_product_remove(category_id, product_id, db)


@router.get('/{category_id}/products', response_model=List[ProductResponse])
async def list_products_by_category_endpoint(category_id: int, db: Session = Depends(get_db)):
    return category_product_list(category_id, db)
