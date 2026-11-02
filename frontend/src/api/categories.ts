import apiClient from './client';
import { Category, CategoryCreatePayload, CategoryProduct, Product } from '../types/inventory';

export async function listCategoriesApi(): Promise<Category[]> {
  const response = await apiClient.get<Category[]>('/categories');
  return response.data;
}

export async function getCategoryApi(id: number): Promise<Category> {
  const response = await apiClient.get<Category>(`/categories/${id}`);
  return response.data;
}

export async function createCategoryApi(data: CategoryCreatePayload): Promise<Category> {
  const response = await apiClient.post<Category>('/categories', data);
  return response.data;
}

export async function updateCategoryApi(id: number, data: CategoryCreatePayload): Promise<Category> {
  const response = await apiClient.put<Category>(`/categories/${id}`, data);
  return response.data;
}

export async function deleteCategoryApi(id: number): Promise<{ message?: string }> {
  const response = await apiClient.delete(`/categories/${id}`);
  return response.data;
}

export async function listProductsByCategoryApi(categoryId: number): Promise<Product[]> {
  const response = await apiClient.get<Product[]>(`/categories/${categoryId}/products`);
  return response.data;
}

export async function assignProductToCategoryApi(
  categoryId: number,
  productId: number
): Promise<CategoryProduct> {
  const response = await apiClient.post<CategoryProduct>(
    `/categories/${categoryId}/products/${productId}`
  );
  return response.data;
}

export async function removeProductFromCategoryApi(
  categoryId: number,
  productId: number
): Promise<{ message?: string }> {
  const response = await apiClient.delete(`/categories/${categoryId}/products/${productId}`);
  return response.data;
}

