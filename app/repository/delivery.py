from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, OperationalError
from app.schemas.schema import DeliveryCreate
from app.modules.module import Delivery, Order
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEINTEGRITYERROR, DATABASEOPERATIONALERROR


def select_deliveries(
    db: Session,
    order_id: Optional[int] = None,
    agent_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Delivery]:
    stmt = select(Delivery).order_by(Delivery.scheduled_at.desc(), Delivery.id.desc())
    if order_id is not None:
        stmt = stmt.where(Delivery.order_id == order_id)
    if agent_id is not None:
        stmt = stmt.where(Delivery.agent_id == agent_id)
    if status and status.strip():
        stmt = stmt.where(func.upper(Delivery.status) == status.strip().upper())
    try:
        return list(db.scalars(stmt).all())
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_delivery_by_id(db: Session, delivery_id: int) -> Optional[Delivery]:
    stmt = select(Delivery).where(Delivery.id == delivery_id)
    try:
        return db.scalar(stmt)
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def insert_delivery(db: Session, delivery_data: DeliveryCreate) -> Delivery:
    try:
        new_delivery = Delivery(
            order_id=delivery_data.order_id,
            agent_id=delivery_data.agent_id,
            scheduled_at=delivery_data.scheduled_at,
            status='SCHEDULED',
            delivery_address=delivery_data.delivery_address,
            delivery_for=delivery_data.delivery_for,
            delivered_to=delivery_data.delivered_to or ""
        )
        db.add(new_delivery)
        db.commit()
        db.refresh(new_delivery)
        return new_delivery
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()


def update_delivery_status(
    db: Session,
    delivery: Delivery,
    new_status: str,
    delivered_to: Optional[str] = None
) -> Delivery:
    try:
        delivery.status = new_status.upper()
        if delivered_to is not None:
            delivery.delivered_to = delivered_to

        # If delivered successfully, transition order status to DELIVERED
        if delivery.status == 'DELIVERED':
            order_stmt = select(Order).where(Order.id == delivery.order_id)
            order = db.scalar(order_stmt)
            if order:
                order.order_status = 'DELIVERED'

        db.commit()
        db.refresh(delivery)
        return delivery
    except IntegrityError:
        db.rollback()
        raise DATABASEINTEGRITYERROR()
    except OperationalError:
        db.rollback()
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        db.rollback()
        raise INTERNALDATABASEERROR()
