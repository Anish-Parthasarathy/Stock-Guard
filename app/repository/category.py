from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import CategoryCreate, CategoryGet, CategoryUpdate, CategoryProductCreate
from app.modules.module import Category, CategoryProduct, Product
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def create_category(db: Session, category: CategoryCreate) -> Category:
    try:
        new_category = Category(name=category.name)
        db.add(new_category)
        db.commit()
        db.refresh(new_category)
        return new_category

    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()

    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()

    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def select_category(db: Session, category: CategoryGet) -> Optional[Category]:
    if category.id is not None:
        stmt = select(Category).where(Category.id == category.id)
    else:
        stmt = select(Category).where(Category.name == category.name)

    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_category_by_id(db: Session, category_id: int) -> Optional[Category]:
    stmt = select(Category).where(Category.id == category_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_all_categories(db: Session) -> List[Category]:
    stmt = select(Category)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def update_category(db: Session, category_id: int, category_data: CategoryUpdate) -> Optional[Category]:
    category = select_category_by_id(db, category_id)
    if category is None:
        return None

    try:
        if category_data.name is not None:
            category.name = category_data.name

        db.commit()
        db.refresh(category)
        return category

    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def delete_category(db: Session, category_id: int) -> bool:
    category = select_category_by_id(db, category_id)
    if category is None:
        return False

    try:
        db.delete(category)
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


def create_category_product(db: Session, category_product: CategoryProductCreate) -> CategoryProduct:
    try:
        new_cp = CategoryProduct(
            category_id=category_product.category_id,
            product_id=category_product.product_id
        )
        db.add(new_cp)
        db.commit()
        db.refresh(new_cp)
        return new_cp
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def select_category_product(db: Session, category_id: int, product_id: int) -> Optional[CategoryProduct]:
    stmt = select(CategoryProduct).where(
        CategoryProduct.category_id == category_id,
        CategoryProduct.product_id == product_id
    )
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def delete_category_product(db: Session, category_id: int, product_id: int) -> bool:
    cp = select_category_product(db, category_id, product_id)
    if cp is None:
        return False

    try:
        db.delete(cp)
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


def select_products_by_category(db: Session, category_id: int) -> List[Product]:
    stmt = (
        select(Product)
        .join(CategoryProduct, Product.id == CategoryProduct.product_id)
        .where(CategoryProduct.category_id == category_id)
    )
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()
