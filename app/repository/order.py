from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import OrderCreate
from app.modules.module import Order, OrderContains, Reservation, Stock
from app.repository.exceptions import (
    INTERNALDATABASEERROR,
    DATABASEINTEGRITYERROR,
    DATABASEOPERATIONALERROR,
    InsufficientStockError,
)


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


def select_order_by_id_for_update(db: Session, order_id: int) -> Optional[Order]:
    """
    Acquires a pessimistic row-level lock (FOR UPDATE) on the specified Order.
    """
    stmt = select(Order).where(Order.id == order_id).with_for_update()
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise
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


def select_stocks_for_update(
    db: Session,
    warehouse_id: int,
    product_ids: List[int]
) -> List[Stock]:
    """
    Acquires row-level pessimistic locks (FOR UPDATE) on Stock rows in deterministic
    ascending order of product_id to eliminate circular wait deadlocks.
    """
    sorted_unique_pids = sorted(list(set(product_ids)))
    if not sorted_unique_pids:
        return []

    stmt = (
        select(Stock)
        .where(
            Stock.warehouse_id == warehouse_id,
            Stock.product_id.in_(sorted_unique_pids)
        )
        .order_by(Stock.product_id.asc())
        .with_for_update()
    )
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_active_reservations_quantity(
    db: Session,
    warehouse_id: int,
    product_id: int
) -> int:
    """
    Calculates the sum of active unexpired reservations using the database engine clock func.now().
    """
    stmt = select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
        Reservation.warehouse_id == warehouse_id,
        Reservation.product_id == product_id,
        Reservation.status == 'RESERVED',
        Reservation.expire_at > func.now()
    )
    try:
        return db.scalar(stmt) or 0
    except OperationalError:
        raise
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_order_with_items_and_reservations(
    db: Session,
    order_data: OrderCreate,
    total_amount: float,
    expire_at: datetime
) -> Order:
    """
    Atomically validates inventory under deterministic row-level locks,
    calculates dynamic unreserved availability using the engine clock,
    and inserts Order, line items (OrderContains), and Stock Reservations.
    """
    requested_pids = [item.product_id for item in order_data.items]
    sorted_unique_pids = sorted(list(set(requested_pids)))

    try:
        # 1. Deterministic Lock Ordering in Checkout (product_id ASC FOR UPDATE)
        locked_stocks = select_stocks_for_update(db, order_data.warehouse_id, sorted_unique_pids)

        # 2. Missing Stock Row Guard
        if len(locked_stocks) < len(sorted_unique_pids):
            db.rollback()
            raise InsufficientStockError("Product not stocked in warehouse")

        locked_stock_map = {s.product_id: s for s in locked_stocks}

        # Aggregate requested quantities per product_id
        requested_qty_by_pid = {}
        for item in order_data.items:
            requested_qty_by_pid[item.product_id] = requested_qty_by_pid.get(item.product_id, 0) + item.quantity

        # 3. Dynamic Availability Calculation Under Lock (engine clock func.now())
        for pid, req_qty in requested_qty_by_pid.items():
            stock_row = locked_stock_map[pid]
            active_reserved = db.scalar(
                select(func.coalesce(func.sum(Reservation.quantity), 0)).where(
                    Reservation.warehouse_id == order_data.warehouse_id,
                    Reservation.product_id == pid,
                    Reservation.status == 'RESERVED',
                    Reservation.expire_at > func.now()
                )
            ) or 0

            available = stock_row.quantity - active_reserved
            if available < req_qty:
                db.rollback()
                raise InsufficientStockError(
                    f"Insufficient available stock for Product {pid}. Available: {available}, requested: {req_qty}"
                )

        # 4. Insert Order, OrderContains, and Reservation
        now_utc = datetime.now(timezone.utc)
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
    except (InsufficientStockError, OperationalError):
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def release_order_reservations(db: Session, order: Order) -> Order:
    try:
        reservations_stmt = (
            select(Reservation)
            .where(Reservation.order_id == order.id)
            .with_for_update()
        )
        reservations = list(db.scalars(reservations_stmt).all())
        for res in reservations:
            if res.status == 'RESERVED':
                res.status = 'RELEASED'
        order.order_status = 'CANCELLED'
        db.commit()
        db.refresh(order)
        return order
    except OperationalError:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
