import apiClient from './client';
import { Product, ProductCreatePayload, ProductUpdatePayload } from '../types/inventory';

export async function listProductsApi(): Promise<Product[]> {
  const response = await apiClient.get<Product[]>('/products');
  return response.data;
}

export async function getProductApi(id: number): Promise<Product> {
  const response = await apiClient.get<Product>(`/products/${id}`);
  return response.data;
}

export async function createProductApi(data: ProductCreatePayload): Promise<Product> {
  const response = await apiClient.post<Product>('/products', data);
  return response.data;
}

export async function updateProductApi(id: number, data: ProductUpdatePayload): Promise<Product> {
  const response = await apiClient.put<Product>(`/products/${id}`, data);
  return response.data;
}

export async function deleteProductApi(id: number): Promise<{ message?: string }> {
  const response = await apiClient.delete(`/products/${id}`);
  return response.data;
}

