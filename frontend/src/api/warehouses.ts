import apiClient from './client';
import { Warehouse, WarehouseCreatePayload } from '../types/inventory';

export async function createWarehouseApi(data: WarehouseCreatePayload): Promise<Warehouse> {
  const response = await apiClient.post<Warehouse>('/warehouse/warehouses', data);
  return response.data;
}

export async function getWarehouseApi(params?: {
  id?: number;
  name?: string;
  location?: string;
}): Promise<Warehouse> {
  const response = await apiClient.get<Warehouse>('/warehouse/warehouse', { params });
  return response.data;
}

export async function listWarehousesApi(): Promise<Warehouse[]> {
  try {
    // Attempt analytics warehouse capacity endpoint which returns all facilities
    const response = await apiClient.get<
      Array<{
        warehouse_id: number;
        warehouse_name: string;
        capacity: number;
        total_stored_quantity: number;
        utilization_rate: number;
      }>
    >('/analytics/warehouse-capacity');

    return response.data.map((item) => ({
      id: item.warehouse_id,
      name: item.warehouse_name,
      location: `Facility #${item.warehouse_id}`,
      capacity: item.capacity,
      created_at: new Date().toISOString(),
    }));
  } catch {
    // Fallback if analytics is empty: try fetching warehouse #1
    try {
      const wh = await getWarehouseApi({ id: 1 });
      return wh ? [wh] : [];
    } catch {
      return [];
    }
  }
}

