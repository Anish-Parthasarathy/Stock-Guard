from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, case, and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from app.modules.module import (
    Warehouse,
    Product,
    Stock,
    StockLedger,
    Order,
    Cancellation,
    Return,
    FinancialLedger,
    Supplier,
    PurchaseOrder,
    PurchaseOrderContains,
    PurchaseOrderReceipt,
    PurchaseOrderStatus
)
from app.repository.exceptions import INTERNALDATABASEERROR, DATABASEOPERATIONALERROR


def select_warehouse_capacity_metrics(
    db: Session,
    warehouse_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    stmt = (
        select(
            Warehouse.id.label("warehouse_id"),
            Warehouse.name.label("warehouse_name"),
            Warehouse.location.label("location"),
            Warehouse.capacity.label("capacity"),
            func.coalesce(func.sum(Stock.quantity), 0).label("current_stock_quantity"),
            func.count(func.distinct(Stock.product_id)).label("distinct_products")
        )
        .outerjoin(Stock, Warehouse.id == Stock.warehouse_id)
    )
    if warehouse_id is not None:
        stmt = stmt.where(Warehouse.id == warehouse_id)

    stmt = (
        stmt.group_by(Warehouse.id, Warehouse.name, Warehouse.location, Warehouse.capacity)
        .order_by(Warehouse.id.asc())
    )

    try:
        rows = db.execute(stmt).all()
        result = []
        for row in rows:
            cap = int(row.capacity)
            curr = int(row.current_stock_quantity)
            util = round((curr / cap) * 100, 2) if cap > 0 else 0.0
            result.append({
                "warehouse_id": row.warehouse_id,
                "warehouse_name": row.warehouse_name,
                "location": row.location,
                "capacity": cap,
                "current_stock_quantity": curr,
                "utilization_rate": util,
                "distinct_products": int(row.distinct_products)
            })
        return result
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_low_stock_alerts(
    db: Session,
    warehouse_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    stmt = (
        select(
            Stock.warehouse_id,
            Warehouse.name.label("warehouse_name"),
            Stock.product_id,
            Product.sku.label("product_sku"),
            Product.name.label("product_name"),
            Stock.quantity.label("current_quantity"),
            Stock.reorder_threshold.label("reorder_threshold")
        )
        .join(Product, Stock.product_id == Product.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Stock.quantity <= Stock.reorder_threshold)
    )
    if warehouse_id is not None:
        stmt = stmt.where(Stock.warehouse_id == warehouse_id)

    stmt = stmt.order_by(Stock.warehouse_id.asc(), Stock.quantity.asc())

    try:
        rows = db.execute(stmt).all()
        result = []
        for row in rows:
            deficit = max(0, int(row.reorder_threshold) - int(row.current_quantity))
            result.append({
                "warehouse_id": row.warehouse_id,
                "warehouse_name": row.warehouse_name,
                "product_id": row.product_id,
                "product_sku": row.product_sku,
                "product_name": row.product_name,
                "current_quantity": int(row.current_quantity),
                "reorder_threshold": int(row.reorder_threshold),
                "deficit": deficit
            })
        return result
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_dead_stock(
    db: Session,
    days: int = 30,
    warehouse_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    now_utc = datetime.now(timezone.utc)
    cutoff_date = (now_utc - timedelta(days=days)).replace(tzinfo=None)

    subq = (
        select(
            StockLedger.warehouse_id,
            StockLedger.product_id,
            func.max(StockLedger.created_at).label("last_movement_at")
        )
        .group_by(StockLedger.warehouse_id, StockLedger.product_id)
        .subquery()
    )

    stmt = (
        select(
            Stock.warehouse_id,
            Warehouse.name.label("warehouse_name"),
            Stock.product_id,
            Product.sku.label("product_sku"),
            Product.name.label("product_name"),
            Stock.quantity,
            Product.price.label("unit_price"),
            Stock.updated_at,
            subq.c.last_movement_at
        )
        .join(Product, Stock.product_id == Product.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .outerjoin(
            subq,
            and_(
                Stock.warehouse_id == subq.c.warehouse_id,
                Stock.product_id == subq.c.product_id
            )
        )
        .where(Stock.quantity > 0)
        .where(
            or_(
                and_(subq.c.last_movement_at.is_(None), Stock.updated_at < cutoff_date),
                subq.c.last_movement_at < cutoff_date
            )
        )
    )
    if warehouse_id is not None:
        stmt = stmt.where(Stock.warehouse_id == warehouse_id)

    stmt = stmt.order_by(Stock.warehouse_id.asc(), Stock.quantity.desc())

    try:
        rows = db.execute(stmt).all()
        result = []
        for row in rows:
            last_mov = row.last_movement_at
            stock_updated = row.updated_at
            
            # Determine effective movement for days_inactive calculation
            effective_dt = last_mov or stock_updated
            if effective_dt and effective_dt.tzinfo is None:
                effective_dt = effective_dt.replace(tzinfo=timezone.utc)
            days_inactive = max(0, (now_utc - effective_dt).days) if effective_dt else None

            # last_movement_at reported to client preserves actual ledger timestamp
            if last_mov and last_mov.tzinfo is None:
                last_mov = last_mov.replace(tzinfo=timezone.utc)

            total_tied = round(int(row.quantity) * float(row.unit_price), 2)
            result.append({
                "warehouse_id": row.warehouse_id,
                "warehouse_name": row.warehouse_name,
                "product_id": row.product_id,
                "product_sku": row.product_sku,
                "product_name": row.product_name,
                "quantity": int(row.quantity),
                "unit_price": float(row.unit_price),
                "total_tied_capital": total_tied,
                "last_movement_at": last_mov,
                "days_inactive": days_inactive
            })
        return result
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_fulfillment_metrics(
    db: Session,
    warehouse_id: Optional[int] = None
) -> Dict[str, Any]:
    try:
        order_filter = []
        if warehouse_id is not None:
            order_filter.append(Order.warehouse_id == warehouse_id)

        total_orders = db.scalar(select(func.count(Order.id)).where(*order_filter)) or 0
        delivered_orders = db.scalar(
            select(func.count(Order.id)).where(
                func.upper(Order.order_status) == "DELIVERED",
                *order_filter
            )
        ) or 0

        if warehouse_id is not None:
            cancelled_orders = db.scalar(
                select(func.count(func.distinct(Cancellation.order_id)))
                .join(Order, Cancellation.order_id == Order.id)
                .where(Order.warehouse_id == warehouse_id)
            ) or 0
            returned_orders = db.scalar(
                select(func.count(func.distinct(Return.order_id)))
                .join(Order, Return.order_id == Order.id)
                .where(Order.warehouse_id == warehouse_id)
            ) or 0
            total_revenue = float(db.scalar(
                select(func.coalesce(func.sum(FinancialLedger.amount), 0))
                .join(Order, FinancialLedger.order_id == Order.id)
                .where(
                    func.upper(FinancialLedger.transaction_type) == "PAYMENT",
                    func.upper(FinancialLedger.status) == "SUCCESS",
                    Order.warehouse_id == warehouse_id
                )
            ) or 0.0)
            total_refunded = float(db.scalar(
                select(func.coalesce(func.sum(FinancialLedger.amount), 0))
                .join(Order, FinancialLedger.order_id == Order.id)
                .where(
                    func.upper(FinancialLedger.transaction_type) == "REFUND",
                    func.upper(FinancialLedger.status) == "SUCCESS",
                    Order.warehouse_id == warehouse_id
                )
            ) or 0.0)
        else:
            cancelled_orders = db.scalar(
                select(func.count(func.distinct(Cancellation.order_id)))
            ) or 0
            returned_orders = db.scalar(
                select(func.count(func.distinct(Return.order_id)))
            ) or 0
            total_revenue = float(db.scalar(
                select(func.coalesce(func.sum(FinancialLedger.amount), 0))
                .where(
                    func.upper(FinancialLedger.transaction_type) == "PAYMENT",
                    func.upper(FinancialLedger.status) == "SUCCESS"
                )
            ) or 0.0)
            total_refunded = float(db.scalar(
                select(func.coalesce(func.sum(FinancialLedger.amount), 0))
                .where(
                    func.upper(FinancialLedger.transaction_type) == "REFUND",
                    func.upper(FinancialLedger.status) == "SUCCESS"
                )
            ) or 0.0)

        cancellation_rate = round((cancelled_orders / total_orders) * 100, 2) if total_orders > 0 else 0.0
        return_rate = round((returned_orders / total_orders) * 100, 2) if total_orders > 0 else 0.0
        fulfillment_rate = round((delivered_orders / total_orders) * 100, 2) if total_orders > 0 else 0.0

        return {
            "total_orders": int(total_orders),
            "delivered_orders": int(delivered_orders),
            "cancelled_orders": int(cancelled_orders),
            "returned_orders": int(returned_orders),
            "total_revenue": round(total_revenue, 2),
            "total_refunded": round(total_refunded, 2),
            "cancellation_rate": cancellation_rate,
            "return_rate": return_rate,
            "fulfillment_rate": fulfillment_rate
        }
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()


def select_supplier_performance(
    db: Session,
    supplier_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    try:
        sup_stmt = select(Supplier.id, Supplier.name).order_by(Supplier.id.asc())
        if supplier_id is not None:
            sup_stmt = sup_stmt.where(Supplier.id == supplier_id)
        suppliers = db.execute(sup_stmt).all()

        po_stmt = (
            select(
                PurchaseOrder.supplier_id,
                func.count(PurchaseOrder.id).label("total_pos"),
                func.count(
                    case(
                        (
                            PurchaseOrder.status.in_([
                                PurchaseOrderStatus.FULLY_RECEIVED,
                                PurchaseOrderStatus.CLOSED,
                                "FULLY_RECEIVED",
                                "CLOSED"
                            ]),
                            PurchaseOrder.id
                        ),
                        else_=None
                    )
                ).label("completed_pos")
            )
        )
        if supplier_id is not None:
            po_stmt = po_stmt.where(PurchaseOrder.supplier_id == supplier_id)
        po_stmt = po_stmt.group_by(PurchaseOrder.supplier_id)
        po_data = {row.supplier_id: row for row in db.execute(po_stmt).all()}

        ord_stmt = (
            select(
                PurchaseOrder.supplier_id,
                func.coalesce(func.sum(PurchaseOrderContains.quantity_ordered), 0).label("units_ordered")
            )
            .join(PurchaseOrderContains, PurchaseOrder.id == PurchaseOrderContains.purchase_order_id)
        )
        if supplier_id is not None:
            ord_stmt = ord_stmt.where(PurchaseOrder.supplier_id == supplier_id)
        ord_stmt = ord_stmt.group_by(PurchaseOrder.supplier_id)
        ord_data = {row.supplier_id: row.units_ordered for row in db.execute(ord_stmt).all()}

        rec_stmt = (
            select(
                PurchaseOrder.supplier_id,
                func.coalesce(func.sum(PurchaseOrderReceipt.quantity_received), 0).label("units_received")
            )
            .join(PurchaseOrderReceipt, PurchaseOrder.id == PurchaseOrderReceipt.purchase_order_id)
        )
        if supplier_id is not None:
            rec_stmt = rec_stmt.where(PurchaseOrder.supplier_id == supplier_id)
        rec_stmt = rec_stmt.group_by(PurchaseOrder.supplier_id)
        rec_data = {row.supplier_id: row.units_received for row in db.execute(rec_stmt).all()}

        result = []
        for sup in suppliers:
            p_info = po_data.get(sup.id)
            tot_po = int(p_info.total_pos) if p_info else 0
            comp_po = int(p_info.completed_pos) if p_info else 0
            units_ord = int(ord_data.get(sup.id, 0))
            units_rec = int(rec_data.get(sup.id, 0))
            fulfillment_rate = round((units_rec / units_ord) * 100, 2) if units_ord > 0 else 0.0

            result.append({
                "supplier_id": sup.id,
                "supplier_name": sup.name,
                "total_purchase_orders": tot_po,
                "completed_purchase_orders": comp_po,
                "total_units_ordered": units_ord,
                "total_units_received": units_rec,
                "fulfillment_rate": fulfillment_rate
            })
        return result
    except OperationalError:
        raise DATABASEOPERATIONALERROR()
    except SQLAlchemyError:
        raise INTERNALDATABASEERROR()
