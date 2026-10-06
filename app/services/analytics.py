from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.schema import (
    WarehouseCapacityMetric,
    LowStockAlert,
    DeadStockItem,
    FulfillmentMetrics,
    SupplierPerformanceMetric,
    WarehouseGet
)
from app.repository.analytics import (
    select_warehouse_capacity_metrics,
    select_low_stock_alerts,
    select_dead_stock,
    select_fulfillment_metrics,
    select_supplier_performance
)
from app.repository.warehouse import select_warehouse
from app.repository.supplier import select_supplier_by_id
from app.repository.exceptions import DATABASEOPERATIONALERROR, INTERNALDATABASEERROR


def analytics_warehouse_capacity_service(
    db: Session,
    warehouse_id: Optional[int] = None
) -> List[WarehouseCapacityMetric]:
    if warehouse_id is not None:
        wh = select_warehouse(db, WarehouseGet(id=warehouse_id))
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {warehouse_id} not found"
            )
    try:
        metrics = select_warehouse_capacity_metrics(db, warehouse_id=warehouse_id)
        return [WarehouseCapacityMetric.model_validate(m) for m in metrics]
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


def analytics_low_stock_service(
    db: Session,
    warehouse_id: Optional[int] = None
) -> List[LowStockAlert]:
    if warehouse_id is not None:
        wh = select_warehouse(db, WarehouseGet(id=warehouse_id))
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {warehouse_id} not found"
            )
    try:
        alerts = select_low_stock_alerts(db, warehouse_id=warehouse_id)
        return [LowStockAlert.model_validate(a) for a in alerts]
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


def analytics_dead_stock_service(
    db: Session,
    days: int = 30,
    warehouse_id: Optional[int] = None
) -> List[DeadStockItem]:
    if days < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'days' must be greater than or equal to 1"
        )
    if warehouse_id is not None:
        wh = select_warehouse(db, WarehouseGet(id=warehouse_id))
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {warehouse_id} not found"
            )
    try:
        items = select_dead_stock(db, days=days, warehouse_id=warehouse_id)
        return [DeadStockItem.model_validate(i) for i in items]
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


def analytics_fulfillment_metrics_service(
    db: Session,
    warehouse_id: Optional[int] = None
) -> FulfillmentMetrics:
    if warehouse_id is not None:
        wh = select_warehouse(db, WarehouseGet(id=warehouse_id))
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {warehouse_id} not found"
            )
    try:
        data = select_fulfillment_metrics(db, warehouse_id=warehouse_id)
        return FulfillmentMetrics.model_validate(data)
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


def analytics_supplier_performance_service(
    db: Session,
    supplier_id: Optional[int] = None
) -> List[SupplierPerformanceMetric]:
    if supplier_id is not None:
        sup = select_supplier_by_id(db, supplier_id)
        if not sup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
    try:
        data = select_supplier_performance(db, supplier_id=supplier_id)
        return [SupplierPerformanceMetric.model_validate(d) for d in data]
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
