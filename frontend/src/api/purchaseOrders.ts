import apiClient from './client';
import {
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  PurchaseOrderApprovalPayload,
  PurchaseOrderStatusPayload,
  PurchaseOrderReceiptCreatePayload,
  PurchaseOrderReceipt,
} from '../types/procurement';

export async function listPurchaseOrdersApi(filters?: {
  supplier_id?: number;
  status?: string;
  approved_status?: string;
}): Promise<PurchaseOrder[]> {
  const response = await apiClient.get<PurchaseOrder[]>('/purchase-orders', {
    params: filters,
  });
  return response.data;
}

export async function getPurchaseOrderApi(id: number): Promise<PurchaseOrder> {
  const response = await apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return response.data;
}

export async function createPurchaseOrderApi(
  data: PurchaseOrderCreatePayload
): Promise<PurchaseOrder> {
  const response = await apiClient.post<PurchaseOrder>('/purchase-orders', data);
  return response.data;
}

export async function updatePOApprovalApi(
  id: number,
  data: PurchaseOrderApprovalPayload
): Promise<PurchaseOrder> {
  const response = await apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}/approval`, data);
  return response.data;
}

export async function updatePOStatusApi(
  id: number,
  data: PurchaseOrderStatusPayload
): Promise<PurchaseOrder> {
  const response = await apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, data);
  return response.data;
}

export async function receivePOItemApi(
  id: number,
  data: PurchaseOrderReceiptCreatePayload
): Promise<PurchaseOrderReceipt> {
  const response = await apiClient.post<PurchaseOrderReceipt>(
    `/purchase-orders/${id}/receive`,
    data
  );
  return response.data;
}

