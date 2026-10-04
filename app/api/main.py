from fastapi import FastAPI
from app.api.routes import warehouse, auth, product, category

app = FastAPI(title="Stock Guard")

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
    product.router,
    prefix = "/products",
    tags = ["Product Management"]
)

app.include_router(
    category.router,
    prefix = "/categories",
    tags = ["Category Management"]
)