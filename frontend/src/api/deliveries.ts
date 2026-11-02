import apiClient from './client';
import {
  Delivery,
  DeliveryCreatePayload,
  DeliveryStatusUpdatePayload,
} from '../types/fulfillment';

export async function listDeliveriesApi(filters?: {
  order_id?: number;
  agent_id?: number;
  status?: string;
}): Promise<Delivery[]> {
  const response = await apiClient.get<Delivery[]>('/deliveries', {
    params: filters,
  });
  return response.data;
}

export async function getDeliveryApi(id: number): Promise<Delivery> {
  const response = await apiClient.get<Delivery>(`/deliveries/${id}`);
  return response.data;
}

export async function scheduleDeliveryApi(data: DeliveryCreatePayload): Promise<Delivery> {
  const response = await apiClient.post<Delivery>('/deliveries', data);
  return response.data;
}

export async function updateDeliveryStatusApi(
  id: number,
  data: DeliveryStatusUpdatePayload
): Promise<Delivery> {
  const response = await apiClient.patch<Delivery>(`/deliveries/${id}/status`, data);
  return response.data;
}

