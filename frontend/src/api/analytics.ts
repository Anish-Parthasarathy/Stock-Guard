import apiClient from './client';
import {
  WarehouseCapacityMetric,
  LowStockAlert,
  DeadStockItem,
  FulfillmentMetrics,
  SupplierPerformanceMetric,
} from '../types/analytics';

export async function getWarehouseCapacityApi(
  warehouseId?: number
): Promise<WarehouseCapacityMetric[]> {
  const response = await apiClient.get<WarehouseCapacityMetric[]>('/analytics/warehouse-capacity', {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data;
}

export async function getLowStockAlertsApi(
  warehouseId?: number
): Promise<LowStockAlert[]> {
  const response = await apiClient.get<LowStockAlert[]>('/analytics/low-stock', {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data;
}

export async function getDeadStockApi(
  days: number = 30,
  warehouseId?: number
): Promise<DeadStockItem[]> {
  const response = await apiClient.get<DeadStockItem[]>('/analytics/dead-stock', {
    params: {
      days,
      ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    },
  });
  return response.data;
}

export async function getFulfillmentMetricsApi(
  warehouseId?: number
): Promise<FulfillmentMetrics> {
  const response = await apiClient.get<FulfillmentMetrics>('/analytics/fulfillment-metrics', {
    params: warehouseId ? { warehouse_id: warehouseId } : undefined,
  });
  return response.data;
}

export async function getSupplierPerformanceApi(
  supplierId?: number
): Promise<SupplierPerformanceMetric[]> {
  const response = await apiClient.get<SupplierPerformanceMetric[]>('/analytics/supplier-performance', {
    params: supplierId ? { supplier_id: supplierId } : undefined,
  });
  return response.data;
}

