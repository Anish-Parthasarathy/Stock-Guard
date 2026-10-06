from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import OrderCreate
from app.modules.module import Order, OrderContains, Reservation
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_orders(
    db: Session,
    warehouse_id: Optional[int] = None,
    order_status: Optional[str] = None,
    payment_status: Optional[str] = None
) -> List[Order]:
    stmt = select(Order).order_by(Order.created_at.desc(), Order.id.desc())
    if warehouse_id is not None:
        stmt = stmt.where(Order.warehouse_id == warehouse_id)
    if order_status and order_status.strip():
        stmt = stmt.where(Order.order_status == order_status.strip())
    if payment_status and payment_status.strip():
        stmt = stmt.where(Order.payment_status == payment_status.strip())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_order_by_id(db: Session, order_id: int) -> Optional[Order]:
    stmt = select(Order).where(Order.id == order_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_order_by_external_ref(db: Session, external_ref: str) -> Optional[Order]:
    stmt = select(Order).where(Order.external_reference_id == external_ref)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_order_items(db: Session, order_id: int) -> List[OrderContains]:
    stmt = select(OrderContains).where(OrderContains.order_id == order_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_order_reservations(db: Session, order_id: int) -> List[Reservation]:
    stmt = select(Reservation).where(Reservation.order_id == order_id)
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_active_reservations_quantity(
    db: Session,
    warehouse_id: int,
    product_id: int
) -> int:
    now_utc = datetime.now(timezone.utc)
    stmt = select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
        Reservation.warehouse_id == warehouse_id,
        Reservation.product_id == product_id,
        Reservation.status == 'RESERVED',
        Reservation.expire_at > now_utc
    )
    try:
        return db.scalar(stmt) or 0
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_order_with_items_and_reservations(
    db: Session,
    order_data: OrderCreate,
    total_amount: float,
    expire_at: datetime
) -> Order:
    """
    Atomically creates an Order header, line items (OrderContains), and
    corresponding stock Reservations in a single database transaction.
    """
    now_utc = datetime.now(timezone.utc)
    try:
        new_order = Order(
            warehouse_id=order_data.warehouse_id,
            external_reference_id=order_data.external_reference_id,
            order_status='PENDING',
            payment_status='PENDING',
            total_amount=total_amount,
            created_at=now_utc
        )
        db.add(new_order)
        db.flush()

        for item_data in order_data.items:
            line_item = OrderContains(
                order_id=new_order.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price
            )
            db.add(line_item)
            db.flush()

            reservation = Reservation(
                order_id=new_order.id,
                order_contains_id=line_item.id,
                warehouse_id=order_data.warehouse_id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                created_at=now_utc,
                expire_at=expire_at,
                status='RESERVED'
            )
            db.add(reservation)

        db.commit()
        db.refresh(new_order)
        return new_order
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def release_order_reservations(db: Session, order: Order) -> Order:
    try:
        reservations = select_order_reservations(db, order.id)
        for res in reservations:
            if res.status == 'RESERVED':
                res.status = 'RELEASED'
        order.order_status = 'CANCELLED'
        db.commit()
        db.refresh(order)
        return order
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
