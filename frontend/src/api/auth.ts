import apiClient from './client';
import {
  AuthSession,
  User,
  UserCreatePayload,
  PasswordChangePayload,
  AdminResetPasswordPayload,
  Warehouse,
} from '../types/auth';

export async function loginApi(email: string, password: string):(Promise<AuthSession>) {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await apiClient.post<AuthSession>('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
}

export async function refreshApi(token: string): Promise<string> {
  const response = await apiClient.post<string | { access_token: string }>('/auth/refresh', {
    token,
  });
  return typeof response.data === 'string' ? response.data : response.data.access_token;
}

export async function changePasswordApi(data: PasswordChangePayload): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/change-password', data);
  return response.data;
}

export async function listUsersApi(filters?: { role?: string; warehouse_id?: number }): Promise<User[]> {
  const response = await apiClient.get<User[]>('/users', {
    params: filters,
  });
  return response.data;
}

export async function createUserApi(data: UserCreatePayload): Promise<User> {
  const response = await apiClient.post<User>('/users', data);
  return response.data;
}

export async function adminResetPasswordApi(
  userId: number,
  data: AdminResetPasswordPayload
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/users/${userId}/reset-password`, data);
  return response.data;
}

export async function getWarehouseApi(id?: number): Promise<Warehouse | null> {
  try {
    const response = await apiClient.get<Warehouse>('/warehouse/warehouse', {
      params: id ? { id } : undefined,
    });
    return response.data;
  } catch {
    return null;
  }
}

