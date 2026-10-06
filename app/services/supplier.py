from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import SupplierCreate, SupplierUpdate, SupplierProductCreate
from app.repository.supplier import (
    select_supplier_by_id,
    select_suppliers,
    insert_supplier,
    update_supplier,
    delete_supplier,
    select_supplier_products,
    select_supplier_product,
    insert_supplier_product,
    delete_supplier_product
)
from app.repository.product import select_product_by_id
from app.repository.exceptions import DATABASEINTEGRITYERROR, INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def supplier_create(supplier_data: SupplierCreate, db: Session):
    if not supplier_data.email and not supplier_data.phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of email or phone must be provided for a supplier"
        )
    try:
        return insert_supplier(db, supplier_data)
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


def supplier_list(db: Session) -> List:
    try:
        return select_suppliers(db)
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


def supplier_get(supplier_id: int, db: Session):
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )
    return supplier


def supplier_update(supplier_id: int, update_data: SupplierUpdate, db: Session):
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )

    # Check if resulting contact info would be empty
    final_email = update_data.email if update_data.email is not None else supplier.email
    final_phone = update_data.phone if update_data.phone is not None else supplier.phone
    if not final_email and not final_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of email or phone must remain populated for a supplier"
        )

    try:
        return update_supplier(db, supplier, update_data)
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


def supplier_product_add(supplier_id: int, sp_data: SupplierProductCreate, db: Session):
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )

    product = select_product_by_id(db, sp_data.product_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {sp_data.product_id} not found"
        )

    existing_sp = select_supplier_product(db, supplier_id, sp_data.product_id)
    if existing_sp is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Supplier {supplier_id} already supplies Product {sp_data.product_id}"
        )

    try:
        return insert_supplier_product(db, supplier_id, sp_data)
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


def supplier_product_list(supplier_id: int, db: Session) -> List:
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )
    try:
        return select_supplier_products(db, supplier_id)
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


def supplier_delete(supplier_id: int, db: Session):
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )
    try:
        delete_supplier(db, supplier_id)
        return {"detail": f"Supplier with ID {supplier_id} deleted successfully"}
    except DATABASEINTEGRITYERROR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete supplier because related records (products/orders) exist"
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


def supplier_product_remove(supplier_id: int, product_id: int, db: Session):
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with ID {supplier_id} not found"
        )
    sp = select_supplier_product(db, supplier_id, product_id)
    if sp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} is not linked to Supplier {supplier_id}"
        )
    try:
        delete_supplier_product(db, supplier_id, product_id)
        return {"detail": f"Product {product_id} unlinked from Supplier {supplier_id} successfully"}
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

