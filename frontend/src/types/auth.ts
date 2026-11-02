export type UserRole = 'admin' | 'manager' | 'warehouse_staff' | 'delivery_agent';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole | string;
  warehouse_id: number | null;
  created_at: string;
}

export interface AuthSession {
  email: string;
  name: string;
  role: UserRole | string;
  warehouse_id: number | null;
  created_at: string;
  access_token: string;
  refresh_token: string;
}

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  role: string;
  warehouse_id?: number | null;
}

export interface PasswordChangePayload {
  old_password: string;
  new_password: string;
}

export interface AdminResetPasswordPayload {
  new_password: string;
}

export interface Warehouse {
  id: number;
  name?: string;
  location: string;
  capacity: number;
  created_at: string;
}

