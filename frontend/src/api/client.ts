import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { handleMockRequest } from './mockAdapter';

// Prefer relative '/api' which Vite proxies to http://127.0.0.1:8000, eliminating CORS issues
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });
  failedQueue = [];
};

function generateRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback
  }
  return 'req-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

// ── 1. Request Interceptor: Trace ID, Auth Token, Standalone Demo Mode ──
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // a) Attach distributed tracing correlation ID
    if (config.headers && !config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = generateRequestId();
    }

    // b) Attach JWT token
    const token = localStorage.getItem('stockguard_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // c) Standalone Demo Mode Adapter
    const isDemoMode = localStorage.getItem('stockguard_demo_mode') === 'true';
    if (isDemoMode) {
      const mockData = handleMockRequest(config.url || '', config.method);
      // Fulfill with mock data and cancel network call safely
      config.adapter = async () => ({
        data: mockData,
        status: 200,
        statusText: 'OK (Mock)',
        headers: { 'x-mock-response': 'true' },
        config,
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── 2. Response Interceptor: 401 Refresh, 503 Retry, 409 Conflict & Offline ──
apiClient.interceptors.response.use(
  (response) => {
    // Dispatch successful backend connectivity event
    if (!response.headers?.['x-mock-response']) {
      window.dispatchEvent(new CustomEvent('stockguard:backend_online'));
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _deadlockRetry?: boolean;
    };

    // a) Network Connectivity Failure / Backend Unreachable
    if (!error.response || error.code === 'ERR_NETWORK') {
      window.dispatchEvent(
        new CustomEvent('stockguard:network_error', {
          detail: 'Unable to reach backend server. Please verify the server is running.',
        })
      );
      return Promise.reject(error);
    }

    // b) HTTP 503 Concurrency Deadlock / Serialization Failure: Retry with Backoff
    if (error.response?.status === 503 && !originalRequest?._deadlockRetry) {
      originalRequest._deadlockRetry = true;
      const retryAfterSec = parseInt(error.response.headers['retry-after'] || '1', 10);
      const backoffMs = (isNaN(retryAfterSec) ? 1 : retryAfterSec) * 1000 + Math.random() * 200;

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return apiClient(originalRequest);
    }

    // c) HTTP 409 Concurrency / Inventory Conflicts: Dispatch Conflict Event
    if (error.response?.status === 409) {
      const errorDetail = (error.response.data as any)?.detail || 'Conflict detected. Resource was modified.';
      window.dispatchEvent(
        new CustomEvent('stockguard:conflict', {
          detail: errorDetail,
        })
      );
    }

    // d) HTTP 401 Unauthorized: Automatic Refresh Token Rotation
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              resolve(apiClient(originalRequest));
            },
            reject: (err) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('stockguard_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('stockguard_access_token');
        localStorage.removeItem('stockguard_refresh_token');
        localStorage.removeItem('stockguard_user');
        window.dispatchEvent(new CustomEvent('stockguard:unauthorized'));
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          token: refreshToken,
        });

        const newAccessToken =
          typeof response.data === 'string' ? response.data : response.data.access_token;
        localStorage.setItem('stockguard_access_token', newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('stockguard_access_token');
        localStorage.removeItem('stockguard_refresh_token');
        localStorage.removeItem('stockguard_user');
        window.dispatchEvent(new CustomEvent('stockguard:unauthorized'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
