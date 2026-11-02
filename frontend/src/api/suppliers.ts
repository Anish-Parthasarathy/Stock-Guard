import apiClient from './client';
import {
  Supplier,
  SupplierCreatePayload,
  SupplierUpdatePayload,
  SupplierProduct,
  SupplierProductCreatePayload,
} from '../types/procurement';

export async function listSuppliersApi(): Promise<Supplier[]> {
  const response = await apiClient.get<Supplier[]>('/suppliers');
  return response.data;
}

export async function getSupplierApi(id: number): Promise<Supplier> {
  const response = await apiClient.get<Supplier>(`/suppliers/${id}`);
  return response.data;
}

export async function createSupplierApi(data: SupplierCreatePayload): Promise<Supplier> {
  const response = await apiClient.post<Supplier>('/suppliers', data);
  return response.data;
}

export async function updateSupplierApi(id: number, data: SupplierUpdatePayload): Promise<Supplier> {
  const response = await apiClient.put<Supplier>(`/suppliers/${id}`, data);
  return response.data;
}

export async function deleteSupplierApi(id: number): Promise<{ message?: string }> {
  const response = await apiClient.delete(`/suppliers/${id}`);
  return response.data;
}

export async function listSupplierProductsApi(supplierId: number): Promise<SupplierProduct[]> {
  const response = await apiClient.get<SupplierProduct[]>(`/suppliers/${supplierId}/products`);
  return response.data;
}

export async function addSupplierProductApi(
  supplierId: number,
  data: SupplierProductCreatePayload
): Promise<SupplierProduct> {
  const response = await apiClient.post<SupplierProduct>(`/suppliers/${supplierId}/products`, data);
  return response.data;
}

export async function removeSupplierProductApi(
  supplierId: number,
  productId: number
): Promise<{ message?: string }> {
  const response = await apiClient.delete(`/suppliers/${supplierId}/products/${productId}`);
  return response.data;
}

