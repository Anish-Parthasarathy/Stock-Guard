from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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
    analytics
)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Stock Guard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    analytics.router,
    prefix = "/analytics",
    tags = ["Analytics & Reporting"]
)

app.include_router(
    warehouse.router,
    prefix = "/warehouse",
    tags = ["Warehouse Management"]
)

app.include_router(
    auth.router,
    prefix = "/auth",
    tags = ["Authentication"]
)

app.include_router(
    auth.user_router,
    prefix = "/users",
    tags = ["User Management"]
)

app.include_router(
    product.router,
    prefix = "/products",
    tags = ["Product Management"]
)

app.include_router(
    category.router,
    prefix = "/categories",
    tags = ["Category Management"]
)

app.include_router(
    stock.router,
    prefix = "/stock",
    tags = ["Stock Management"]
)

app.include_router(
    supplier.router,
    prefix = "/suppliers",
    tags = ["Supplier Management"]
)

app.include_router(
    purchase_order.router,
    prefix = "/purchase-orders",
    tags = ["Purchase Order Management"]
)

app.include_router(
    order.router,
    prefix = "/orders",
    tags = ["Order Fulfillment"]
)

app.include_router(
    financial_ledger.router,
    prefix = "/financial-ledger",
    tags = ["Financial Ledger"]
)

app.include_router(
    transfer.router,
    prefix = "/transfers",
    tags = ["Intra-Warehouse Transfers"]
)

app.include_router(
    delivery.router,
    prefix = "/deliveries",
    tags = ["Delivery Management"]
)

app.include_router(
    cancellation.router,
    prefix = "/cancellations",
    tags = ["Order Cancellations"]
)

app.include_router(
    return_order.router,
    prefix = "/returns",
    tags = ["Reverse Logistics & Returns"]
)


@app.exception_handler(OptimisticLockConflictError)
async def optimistic_lock_conflict_handler(request: Request, exc: OptimisticLockConflictError):
    return JSONResponse(
        status_code=409,
        content={"detail": exc.message}
    )


@app.exception_handler(InsufficientStockError)
async def insufficient_stock_handler(request: Request, exc: InsufficientStockError):
    return JSONResponse(
        status_code=409,
        content={"detail": exc.message}
    )


@app.exception_handler(ReservationExpiredError)
async def reservation_expired_handler(request: Request, exc: ReservationExpiredError):
    return JSONResponse(
        status_code=409,
        content={"detail": exc.message}
    )


@app.exception_handler(ConcurrencyDeadlockError)
async def concurrency_deadlock_handler(request: Request, exc: ConcurrencyDeadlockError):
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": str(exc.retry_after)},
        content={"detail": exc.message}
    )




