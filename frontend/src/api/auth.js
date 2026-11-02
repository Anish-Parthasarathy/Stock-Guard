/**
 * StockGuard Authentication & User Management API Service
 * Handles token persistence, request interception, and auth/user endpoints.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

export function getStoredAuth() {
  const token = localStorage.getItem('stockguard_access_token');
  const userStr = localStorage.getItem('stockguard_user');
  try {
    return {
      token,
      user: userStr ? JSON.parse(userStr) : null,
    };
  } catch (e) {
    return { token: null, user: null };
  }
}

export function saveAuth(authData) {
  if (authData.access_token) {
    localStorage.setItem('stockguard_access_token', authData.access_token);
  }
  if (authData.refresh_token) {
    localStorage.setItem('stockguard_refresh_token', authData.refresh_token);
  }
  const user = {
    email: authData.email,
    name: authData.name,
    role: authData.role,
    warehouse_id: authData.warehouse_id,
    created_at: authData.created_at,
  };
  localStorage.setItem('stockguard_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('stockguard_access_token');
  localStorage.removeItem('stockguard_refresh_token');
  localStorage.removeItem('stockguard_user');
}

async function apiFetch(endpoint, options = {}) {
  const { token } = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    // Attempt token refresh or logout
    clearAuth();
    window.dispatchEvent(new Event('stockguard_unauthorized'));
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

export async function loginUser(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Authentication failed');
  }

  saveAuth(data);
  return data;
}

export async function refreshAccessToken(refreshToken) {
  return apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ token: refreshToken }),
  });
}

export async function changePassword(oldPassword, newPassword) {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });
}

// -------------------------------------------------------------
// User Management Endpoints (Admin Only)
// -------------------------------------------------------------

export async function fetchUsers({ role, warehouse_id } = {}) {
  const query = new URLSearchParams();
  if (role) query.append('role', role);
  if (warehouse_id) query.append('warehouse_id', warehouse_id);
  const qStr = query.toString();
  return apiFetch(`/users${qStr ? `?${qStr}` : ''}`);
}

export async function createUser(userData) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function adminResetPassword(userId, newPassword) {
  return apiFetch(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function fetchWarehouses() {
  try {
    return await apiFetch('/warehouse/warehouse');
  } catch {
    return [];
  }
}
