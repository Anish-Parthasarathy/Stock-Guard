import apiClient from './client';
import {
  Order,
  PaymentCreatePayload,
  OrderCancelPayload,
  Cancellation,
  FinancialLedgerEntry,
} from '../types/fulfillment';

export async function listOrdersApi(filters?: {
  warehouse_id?: number;
  order_status?: string;
  payment_status?: string;
}): Promise<Order[]> {
  const response = await apiClient.get<Order[]>('/orders', {
    params: filters,
  });
  return response.data;
}

export async function getOrderApi(id: number): Promise<Order> {
  const response = await apiClient.get<Order>(`/orders/${id}`);
  return response.data;
}

export async function processOrderPaymentApi(
  id: number,
  data: PaymentCreatePayload
): Promise<FinancialLedgerEntry> {
  const response = await apiClient.post<FinancialLedgerEntry>(`/orders/${id}/payments`, data);
  return response.data;
}

export async function releaseOrderReservationApi(id: number): Promise<Order> {
  const response = await apiClient.post<Order>(`/orders/${id}/release-reservation`);
  return response.data;
}

export async function cancelOrderApi(
  id: number,
  data: OrderCancelPayload
): Promise<Cancellation> {
  const response = await apiClient.post<Cancellation>(`/orders/${id}/cancel`, data);
  return response.data;
}

