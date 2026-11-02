# StockGuard Middleware Architecture & Full-Stack Integration Plan

This plan outlines the architecture and implementation phases for the middleware layers required to seamlessly bridge the **React + TypeScript frontend** with the **FastAPI + SQLAlchemy backend**, while incorporating essential production-grade middleware features that make the web application resilient, observable, secure, and user-friendly.

---

## 1. Architectural Overview: The 4 Middleware Layers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER / REACT FRONTEND                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND CLIENT MIDDLEWARE                   │  │
│  │  - Auth Token Injector           - Offline / Demo Mode Switch    │  │
│  │  - Request ID Generator          - 401 Refresh Rotation Queue    │  │
│  │  - Network Connectivity Monitor  - Global Error & Toast Bus      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   NETWORK & GATEWAY MIDDLEWARE (DEV/PROD)              │
│  - Vite Reverse Proxy (/api/* -> http://127.0.0.1:8000)                │
│  - Single-Origin Routing (Eliminates Cross-Origin CORS friction)       │
│  - Dynamic Environment BaseURL Switcher                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND HTTP MIDDLEWARE PIPELINE             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  1. Request ID & Tracing (X-Request-ID)                          │  │
│  │  2. Performance Profiling (X-Process-Time header & slow query log)│  │
│  │  3. CORS & Security Headers (CSP, HSTS, X-Frame-Options)         │  │
│  │  4. Centralized Exception & Concurrency Translation              │  │
│  │  5. Rate Limiting & Brute-Force Protection                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQLAlchemy 2.0
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL DATABASE                            │
│  - Lock Timeouts (SET LOCAL lock_timeout = '3s')                       │
│  - Concurrency Retry Backoff & Optimistic Version Checks              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Breakdown of Middleware Components

### Layer 1: Connection & Gateway Middleware
*Goal: Provide a unified, reliable transport bridge between frontend and backend.*

1. **Vite Reverse Proxy & BaseURL Harmonization**:
   - Route all frontend API calls through relative `/api/*` in development.
   - Vite proxy in `vite.config.ts` transparently rewrites `/api/xyz` to `http://127.0.0.1:8000/xyz`.
   - Eliminates CORS issues in local development and standardizes deployment under a unified reverse proxy (e.g. Nginx/Caddy) in production.
2. **Backend Health & Telemetry Probe (`GET /health`)**:
   - An unauthenticated health check endpoint verifying:
     - API server availability
     - PostgreSQL database connection pool viability
     - Application uptime and version info
3. **Frontend Connectivity Heartbeat & Status Indicator**:
   - A lightweight background ping in the frontend that detects if the backend is **Online**, **Connecting**, or **Offline**.
   - Displays a clean status badge in the UI header and an actionable top banner when the backend is unreachable.

---

### Layer 2: Backend HTTP Middleware Pipeline (FastAPI)
*Goal: Enforce security, tracing, standardized error contracts, and performance logging.*

1. **Request ID & Distributed Tracing Middleware**:
   - Inspects incoming requests for `X-Request-ID` or generates a unique UUIDv4.
   - Attaches `X-Request-ID` to response headers and contextual logger records.
   - Ensures any error returned to the user contains a correlation ID for rapid debugging.
2. **Execution Timing & Latency Profiling Middleware**:
   - Calculates high-precision request duration (`time.perf_counter()`).
   - Appends `X-Process-Time` to response headers.
   - Emits warning logs for slow database queries (> 500ms).
3. **Global Standardized Exception Middleware**:
   - Replaces fragmented error responses with a standardized error schema:
     ```json
     {
       "error": true,
       "status_code": 409,
       "error_code": "OPTIMISTIC_LOCK_CONFLICT",
       "detail": "Record was updated by another process. Please reload.",
       "request_id": "a91b2c3d-...",
       "timestamp": "2026-11-02T14:30:00Z"
     }
     ```
   - Automatically maps custom repository exceptions (`OptimisticLockConflictError`, `InsufficientStockError`, `ReservationExpiredError`, `ConcurrencyDeadlockError`).
4. **Security Headers Middleware**:
   - Injects security headers:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 1; mode=block`
     - `Referrer-Policy: strict-origin-when-cross-origin`
5. **Rate Limiting Middleware**:
   - In-memory token bucket / sliding window rate limiter.
   - Protects critical endpoints like `/auth/login` (e.g., max 5 attempts/min per IP) and `/orders` (max 100 req/min).

---

### Layer 3: Frontend Client Middleware (Axios & React Interceptors)
*Goal: Provide robust request preparation, intelligent error recovery, and seamless offline behavior.*

1. **Request Interceptor Pipeline**:
   - Automatically injects JWT Bearer token from storage.
   - Attaches `X-Request-ID` to every outgoing request.
   - Automatically attaches `Content-Type: application/json` or `application/x-www-form-urlencoded` appropriately.
2. **Response Interceptor Pipeline**:
   - **401 Unauthorized**: Thread-safe refresh token rotation with request queuing (already drafted, hardened with expiry countdown).
   - **409 Conflict**: Automatic conflict classification (Optimistic Concurrency vs Insufficient Inventory) with user-friendly toast feedback.
   - **503 Service Unavailable / Deadlock**: Respects `Retry-After` header and performs exponential backoff retries before showing an error.
   - **Network Error / Connection Refused**: Intercepts `ERR_CONNECTION_REFUSED` or timeout, triggering a global toast without crashing the UI.
3. **Offline / Standalone Demo Mode Adapter**:
   - An interceptor-level mock switch: when enabled or when backend is down, returns realistic mock data for all endpoints.
   - Allows product demos, automated frontend tests, and UI reviews completely independent of backend/DB infrastructure.

---

### Layer 4: Website Completion Features
*Goal: Provide the polish, resilience, and interactive tooling expected of modern enterprise SaaS applications.*

1. **Global Toast & Alert Event Bus**:
   - Centralized pub/sub mechanism linking HTTP errors directly to non-blocking toast notifications.
   - Removes boilerplate `try/catch` and repetitive toast calls inside individual components.
2. **Session Heartbeat & Expiry Warning**:
   - Tracks JWT lifespan and notifies the user with a discreet modal: *"Your session will expire in 2 minutes. Click here to stay signed in."*
3. **Global Network Status Banner**:
   - Sticky top alert bar when the client loses internet or backend connection.
   - Automatically re-validates pending queries when connection is restored.
4. **API Inspector / Debug Drawer (Dev Mode)**:
   - Built-in developer drawer showing recent API calls, latency, status codes, request payloads, and response bodies for fast pair-debugging.

---

## 3. Phased Implementation Roadmap

### Phase A: Gateway & Connection Foundations
- [ ] Implement `GET /health` in backend with database ping check (`SELECT 1`).
- [ ] Configure Vite proxy for `/api` in `frontend/vite.config.ts`.
- [ ] Update `frontend/src/api/client.ts` to use unified `/api` base URL with environment fallback.
- [ ] Add live Backend Connection Status badge to the top navbar.

### Phase B: Backend Middleware Pipeline
- [ ] Add Request ID middleware in `app/api/main.py`.
- [ ] Add Performance Timing (`X-Process-Time`) middleware.
- [ ] Add Security Headers middleware.
- [ ] Standardize global exception handling envelope across all route handlers.
- [ ] Add basic rate limiter on auth routes.

### Phase C: Frontend Interceptor Hardening & Error Bus
- [ ] Enhance Axios client in `frontend/src/api/client.ts` with request ID attachment and network failure interceptor.
- [ ] Build global `NotificationContext` / toast bus to automatically catch and display API error details.
- [ ] Add 503 deadlock retry backoff handling in frontend interceptor.
- [ ] Add session inactivity / token expiry warning modal.

### Phase D: Standalone Demo Mode & Polish
- [ ] Implement Mock Adapter in frontend for standalone offline preview.
- [ ] Add "Try Demo Mode" toggle on the Login screen.
- [ ] Add Dev API Inspector drawer in development mode.
- [ ] Full end-to-end integration test of both online and offline flows.

