import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.database import SessionLocal
from app.repository.exceptions import (
    OptimisticLockConflictError,
    InsufficientStockError,
    ReservationExpiredError,
    ConcurrencyDeadlockError,
)
from app.api.routes import (
    warehouse,
    auth,
    product,
    category,
    stock,
    supplier,
    purchase_order,
    order,
    financial_ledger,
    transfer,
    delivery,
    cancellation,
    return_order,
    analytics,
)

app = FastAPI(
    title="StockGuard WMS Engine",
    description="Enterprise Warehouse & Inventory Management System with Transactional Concurrency Control",
    version="1.0.0",
)

# ── 1. In-Memory Sliding-Window Rate Limiter ─────────────────────────
# Rate limit tracking: ip -> list of request timestamps
_rate_limit_records: Dict[str, List[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60.0  # 1 minute window
RATE_LIMIT_MAX_AUTH = 15  # Max 15 attempts/min on auth endpoints

# ── 2. Request ID, Timing, Security Headers & Rate Limiting Middleware
@app.middleware("http")
async def stockguard_core_middleware(request: Request, call_next):
    # a) Request ID / Tracing
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = req_id

    # b) Rate Limiting for Auth Endpoints
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()

    if request.url.path.startswith("/auth/login"):
        timestamps = _rate_limit_records[client_ip]
        # Purge entries older than the window
        _rate_limit_records[client_ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
        if len(_rate_limit_records[client_ip]) >= RATE_LIMIT_MAX_AUTH:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={
                    "X-Request-ID": req_id,
                    "Retry-After": "60",
                },
                content={
                    "error": True,
                    "status_code": 429,
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "detail": "Too many login attempts. Please wait 60 seconds before retrying.",
                    "request_id": req_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        _rate_limit_records[client_ip].append(now)

    # c) Execution Timing
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={
                "X-Request-ID": req_id,
                "X-Process-Time": f"{duration_ms:.2f}ms",
            },
            content={
                "error": True,
                "status_code": 500,
                "error_code": "INTERNAL_SERVER_ERROR",
                "detail": "An unexpected server error occurred. Please contact system support.",
                "request_id": req_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    duration_ms = (time.perf_counter() - start_time) * 1000

    # d) Attach Diagnostic & Security Headers
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


# ── 3. CORS Middleware Configuration ────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time", "Retry-After"],
)


# ── 4. Healthcheck & Connectivity Probe ──────────────────────────────
@app.get("/health", tags=["System Health"])
async def health_check():
    """
    Unauthenticated system healthcheck endpoint.
    Performs live database connection ping and returns system metrics.
    """
    db_status = "disconnected"
    latency_ms = None
    t0 = time.perf_counter()

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        db_status = "connected"
    except Exception as e:
        db_status = f"unreachable: {str(e)}"

    is_healthy = db_status == "connected"
    payload = {
        "status": "healthy" if is_healthy else "degraded",
        "service": "StockGuard WMS",
        "database": db_status,
        "database_latency_ms": latency_ms,
        "environment": "production" if not app.debug else "development",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return JSONResponse(
        status_code=status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=payload,
    )


# ── 5. Standardized Exception Handlers ───────────────────────────────
@app.exception_handler(OptimisticLockConflictError)
async def optimistic_lock_conflict_handler(request: Request, exc: OptimisticLockConflictError):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=409,
        headers={"X-Request-ID": req_id},
        content={
            "error": True,
            "status_code": 409,
            "error_code": "OPTIMISTIC_LOCK_CONFLICT",
            "detail": exc.message,
            "request_id": req_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(InsufficientStockError)
async def insufficient_stock_handler(request: Request, exc: InsufficientStockError):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=409,
        headers={"X-Request-ID": req_id},
        content={
            "error": True,
            "status_code": 409,
            "error_code": "INSUFFICIENT_STOCK",
            "detail": exc.message,
            "request_id": req_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(ReservationExpiredError)
async def reservation_expired_handler(request: Request, exc: ReservationExpiredError):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=409,
        headers={"X-Request-ID": req_id},
        content={
            "error": True,
            "status_code": 409,
            "error_code": "RESERVATION_EXPIRED",
            "detail": exc.message,
            "request_id": req_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(ConcurrencyDeadlockError)
async def concurrency_deadlock_handler(request: Request, exc: ConcurrencyDeadlockError):
    req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=503,
        headers={
            "X-Request-ID": req_id,
            "Retry-After": str(exc.retry_after),
        },
        content={
            "error": True,
            "status_code": 503,
            "error_code": "CONCURRENCY_DEADLOCK",
            "detail": exc.message,
            "retry_after_seconds": exc.retry_after,
            "request_id": req_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


# ── 6. Business Routers ──────────────────────────────────────────────
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics & Reporting"])
app.include_router(warehouse.router, prefix="/warehouse", tags=["Warehouse Management"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(auth.user_router, prefix="/users", tags=["User Management"])
app.include_router(product.router, prefix="/products", tags=["Product Management"])
app.include_router(category.router, prefix="/categories", tags=["Category Management"])
app.include_router(stock.router, prefix="/stock", tags=["Stock Management"])
app.include_router(supplier.router, prefix="/suppliers", tags=["Supplier Management"])
app.include_router(purchase_order.router, prefix="/purchase-orders", tags=["Purchase Order Management"])
app.include_router(order.router, prefix="/orders", tags=["Order Fulfillment"])
app.include_router(financial_ledger.router, prefix="/financial-ledger", tags=["Financial Ledger"])
app.include_router(transfer.router, prefix="/transfers", tags=["Intra-Warehouse Transfers"])
app.include_router(delivery.router, prefix="/deliveries", tags=["Delivery Management"])
app.include_router(cancellation.router, prefix="/cancellations", tags=["Order Cancellations"])
app.include_router(return_order.router, prefix="/returns", tags=["Reverse Logistics & Returns"])
