from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import ProductCreate, ProductGet, ProductUpdate
from app.modules.module import Product
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def create_product(db: Session, product: ProductCreate) -> Product:
    try:
        new_product = Product(
            sku=product.sku,
            name=product.name,
            price=product.price,
            description=product.description,
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)
        return new_product

    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()

    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()

    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def select_product(db: Session, product: ProductGet) -> Optional[Product]:
    if product.id is not None:
        stmt = select(Product).where(Product.id == product.id)
    elif product.sku is not None:
        stmt = select(Product).where(Product.sku == product.sku)
    elif product.name is not None:
        stmt = select(Product).where(Product.name == product.name)
    else:
        raise ValueError("At least one of id, sku, or name must be provided to select_product")

    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_product_by_id(db: Session, product_id: int) -> Optional[Product]:
    stmt = select(Product).where(Product.id == product_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_all_products(db: Session) -> List[Product]:
    stmt = select(Product)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def update_product(db: Session, product_id: int, product_data: ProductUpdate) -> Optional[Product]:
    product = select_product_by_id(db, product_id)
    if product is None:
        return None

    try:
        if product_data.name is not None:
            product.name = product_data.name
        if product_data.sku is not None:
            product.sku = product_data.sku
        if product_data.price is not None:
            product.price = product_data.price
        if product_data.description is not None:
            product.description = product_data.description
        product.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(product)
        return product

    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def delete_product(db: Session, product_id: int) -> bool:
    product = select_product_by_id(db, product_id)
    if product is None:
        return False

    try:
        db.delete(product)
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
