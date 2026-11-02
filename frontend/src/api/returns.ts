import apiClient from './client';
import {
  ReturnOrder,
  ReturnCreatePayload,
  ReturnReceiptCreatePayload,
  ReturnReceipt,
} from '../types/fulfillment';

export async function listReturnsApi(filters?: {
  order_id?: number;
  status?: string;
}): Promise<ReturnOrder[]> {
  const response = await apiClient.get<ReturnOrder[]>('/returns', {
    params: filters,
  });
  return response.data;
}

export async function getReturnApi(id: number): Promise<ReturnOrder> {
  const response = await apiClient.get<ReturnOrder>(`/returns/${id}`);
  return response.data;
}

export async function createReturnApi(data: ReturnCreatePayload): Promise<ReturnOrder> {
  const response = await apiClient.post<ReturnOrder>('/returns', data);
  return response.data;
}

export async function receiveReturnItemApi(
  id: number,
  data: ReturnReceiptCreatePayload
): Promise<ReturnReceipt> {
  const response = await apiClient.post<ReturnReceipt>(`/returns/${id}/receive`, data);
  return response.data;
}

