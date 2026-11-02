import apiClient from './client';
import {
  Transfer,
  TransferCreatePayload,
  TransferReceiptCreatePayload,
  TransferReceipt,
} from '../types/fulfillment';

export async function listTransfersApi(filters?: {
  source_warehouse_id?: number;
  destination_warehouse_id?: number;
  status?: string;
}): Promise<Transfer[]> {
  const response = await apiClient.get<Transfer[]>('/transfers', {
    params: filters,
  });
  return response.data;
}

export async function getTransferApi(id: number): Promise<Transfer> {
  const response = await apiClient.get<Transfer>(`/transfers/${id}`);
  return response.data;
}

export async function dispatchTransferApi(data: TransferCreatePayload): Promise<Transfer> {
  const response = await apiClient.post<Transfer>('/transfers', data);
  return response.data;
}

export async function receiveTransferItemApi(
  id: number,
  data: TransferReceiptCreatePayload
): Promise<TransferReceipt> {
  const response = await apiClient.post<TransferReceipt>(`/transfers/${id}/receive`, data);
  return response.data;
}

