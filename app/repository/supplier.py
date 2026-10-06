from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import SupplierCreate, SupplierUpdate, SupplierProductCreate
from app.modules.module import Supplier, SupplierProduct
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_supplier_by_id(db: Session, supplier_id: int) -> Optional[Supplier]:
    stmt = select(Supplier).where(Supplier.id == supplier_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_suppliers(db: Session) -> List[Supplier]:
    stmt = select(Supplier)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_supplier(db: Session, supplier_data: SupplierCreate) -> Supplier:
    try:
        new_supplier = Supplier(
            name=supplier_data.name,
            email=supplier_data.email,
            phone=supplier_data.phone
        )
        db.add(new_supplier)
        db.commit()
        db.refresh(new_supplier)
        return new_supplier
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def update_supplier(db: Session, supplier: Supplier, update_data: SupplierUpdate) -> Supplier:
    try:
        if update_data.name is not None:
            supplier.name = update_data.name
        if update_data.email is not None:
            supplier.email = update_data.email
        if update_data.phone is not None:
            supplier.phone = update_data.phone
        db.commit()
        db.refresh(supplier)
        return supplier
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_supplier_products(db: Session, supplier_id: int) -> List[SupplierProduct]:
    stmt = select(SupplierProduct).where(SupplierProduct.supplier_id == supplier_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_supplier_product(db: Session, supplier_id: int, product_id: int) -> Optional[SupplierProduct]:
    stmt = select(SupplierProduct).where(
        SupplierProduct.supplier_id == supplier_id,
        SupplierProduct.product_id == product_id
    )
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_supplier_product(
    db: Session,
    supplier_id: int,
    sp_data: SupplierProductCreate
) -> SupplierProduct:
    try:
        new_sp = SupplierProduct(
            supplier_id=supplier_id,
            product_id=sp_data.product_id,
            supplier_sku=sp_data.supplier_sku,
            unit_price=sp_data.unit_price,
            time_required_in_days=sp_data.time_required_in_days
        )
        db.add(new_sp)
        db.commit()
        db.refresh(new_sp)
        return new_sp
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def delete_supplier(db: Session, supplier_id: int) -> bool:
    supplier = select_supplier_by_id(db, supplier_id)
    if supplier is None:
        return False
    try:
        db.delete(supplier)
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def delete_supplier_product(db: Session, supplier_id: int, product_id: int) -> bool:
    sp = select_supplier_product(db, supplier_id, product_id)
    if sp is None:
        return False
    try:
        db.delete(sp)
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()

