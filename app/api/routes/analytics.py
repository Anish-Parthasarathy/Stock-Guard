from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.schemas.schema import (
    WarehouseCapacityMetric,
    LowStockAlert,
    DeadStockItem,
    FulfillmentMetrics,
    SupplierPerformanceMetric
)
from app.services.analytics import (
    analytics_warehouse_capacity_service,
    analytics_low_stock_service,
    analytics_dead_stock_service,
    analytics_fulfillment_metrics_service,
    analytics_supplier_performance_service
)
from app.api.deps import get_db, get_user

router = APIRouter()


@router.get('/warehouse-capacity', response_model=List[WarehouseCapacityMetric])
async def get_warehouse_capacity_endpoint(
    warehouse_id: Optional[int] = Query(None, gt=0, description="Optional warehouse ID filter"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    """
    Retrieve warehouse capacity utilization across all warehouses or for a specific warehouse.
    """
    return analytics_warehouse_capacity_service(db, warehouse_id=warehouse_id)


@router.get('/low-stock', response_model=List[LowStockAlert])
async def get_low_stock_alerts_endpoint(
    warehouse_id: Optional[int] = Query(None, gt=0, description="Optional warehouse ID filter"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    """
    Identify products currently at or below their reorder threshold across warehouses.
    """
    return analytics_low_stock_service(db, warehouse_id=warehouse_id)


@router.get('/dead-stock', response_model=List[DeadStockItem])
async def get_dead_stock_endpoint(
    days: int = Query(30, ge=1, description="Number of days without movement to qualify as dead stock"),
    warehouse_id: Optional[int] = Query(None, gt=0, description="Optional warehouse ID filter"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    """
    Detect slow-moving or dead stock with zero inventory ledger movement over the past N days.
    """
    return analytics_dead_stock_service(db, days=days, warehouse_id=warehouse_id)


@router.get('/fulfillment-metrics', response_model=FulfillmentMetrics)
async def get_fulfillment_metrics_endpoint(
    warehouse_id: Optional[int] = Query(None, gt=0, description="Optional warehouse ID filter"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    """
    Calculate high-level fulfillment KPIs, cancellation rates, return rates, and financial totals.
    """
    return analytics_fulfillment_metrics_service(db, warehouse_id=warehouse_id)


@router.get('/supplier-performance', response_model=List[SupplierPerformanceMetric])
async def get_supplier_performance_endpoint(
    supplier_id: Optional[int] = Query(None, gt=0, description="Optional supplier ID filter"),
    db: Session = Depends(get_db),
    user: dict = Depends(get_user)
):
    """
    Analyze procurement fulfillment performance per supplier (units ordered vs received).
    """
    return analytics_supplier_performance_service(db, supplier_id=supplier_id)

