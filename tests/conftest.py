import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.main import app
from app.core.database import SessionLocal
from app.modules.module import Warehouse, User
from app.core.security import create_password, create_access_token


ALL_APP_TABLES = [
    'return_reciepts', 'return_contains', 'returns',
    'cancellation', 'delivery',
    'financial_ledger', 'reservation', 'order_contains', 'orders',
    'transfer_receipt', 'transfer_contains', 'transfer',
    'purchase_order_receipts', 'purchase_order_contains', 'purchase_order',
    'stock_ledger', 'stock',
    'supplier_products', 'suppliers',
    'category_products', 'category', 'products',
    'users', 'warehouse'
]


def truncate_all_tables():
    db = SessionLocal()
    try:
        table_list = ", ".join(ALL_APP_TABLES)
        db.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE;"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure database tables are cleaned before running tests."""
    truncate_all_tables()
    yield
    truncate_all_tables()


@pytest.fixture
def db():
    """Provides a fresh database session for direct model queries in tests."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_warehouse(db):
    """Provides a persistent test warehouse."""
    wh = db.query(Warehouse).filter_by(name="Test Hub Alpha").first()
    if not wh:
        wh = Warehouse(
            name="Test Hub Alpha",
            location="Zone 1, Central Terminal",
            capacity=100000,
            created_at=datetime.now(timezone.utc).date()
        )
        db.add(wh)
        db.commit()
        db.refresh(wh)
    return wh


@pytest.fixture
def seeded_user(db, seeded_warehouse):
    """Provides a persistent test admin user."""
    user = db.query(User).filter_by(email="admin@stockguard.test").first()
    if not user:
        user = User(
            name="Test Admin",
            email="admin@stockguard.test",
            password_hash=create_password("Password123!"),
            role="admin",
            warehouse_id=seeded_warehouse.id,
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@pytest.fixture
def auth_token(seeded_user, seeded_warehouse):
    """Generates a valid JWT access token for the test admin."""
    return create_access_token(
        email=seeded_user.email,
        role=seeded_user.role,
        warehouse_id=seeded_warehouse.id
    )


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def client(auth_headers):
    """TestClient pre-configured with valid admin JWT authorization header."""
    c = TestClient(app)
    c.headers.update(auth_headers)
    return c


@pytest.fixture
def unauth_client():
    """TestClient without any authorization headers."""
    return TestClient(app)
