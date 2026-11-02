import apiClient from './client';
import {
  Stock,
  StockCreatePayload,
  StockAdjustmentPayload,
  StockLedger,
} from '../types/inventory';

export async function listStockApi(filters?: {
  warehouse_id?: number;
  product_id?: number;
  low_stock?: boolean;
}): Promise<Stock[]> {
  const response = await apiClient.get<Stock[]>('/stock', {
    params: filters,
  });
  return response.data;
}

export async function getStockApi(warehouseId: number, productId: number): Promise<Stock> {
  const response = await apiClient.get<Stock>(`/stock/${warehouseId}/${productId}`);
  return response.data;
}

export async function createStockApi(data: StockCreatePayload): Promise<Stock> {
  const response = await apiClient.post<Stock>('/stock', data);
  return response.data;
}

export async function adjustStockApi(data: StockAdjustmentPayload): Promise<Stock> {
  const response = await apiClient.post<Stock>('/stock/adjust', data);
  return response.data;
}

export async function listStockLedgerApi(filters?: {
  warehouse_id?: number;
  product_id?: number;
}): Promise<StockLedger[]> {
  const response = await apiClient.get<StockLedger[]>('/stock/ledger', {
    params: filters,
  });
  return response.data;
}

