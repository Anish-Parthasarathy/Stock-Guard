import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.main import app
from app.api.deps import get_db
from app.modules.module import Product, Category, CategoryProduct

# In-memory SQLite for testing without requiring a live Postgres instance
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Phase 1 tables
Product.__table__.create(engine)
Category.__table__.create(engine)
CategoryProduct.__table__.create(engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_create_product():
    payload = {
        "sku": "SKU-001",
        "name": "Widget A",
        "price": 19.99,
        "description": "Standard Widget A"
    }
    response = client.post("/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == "SKU-001"
    assert data["name"] == "Widget A"
    assert data["price"] == 19.99
    assert "id" in data
    assert "updated_at" in data


def test_duplicate_product_sku():
    payload = {
        "sku": "SKU-001",
        "name": "Widget Duplicate",
        "price": 25.0,
        "description": "Duplicate"
    }
    response = client.post("/products", json=payload)
    assert response.status_code == 409


def test_list_products():
    response = client.get("/products")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_product():
    response = client.get("/products/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["sku"] == "SKU-001"


def test_get_nonexistent_product():
    response = client.get("/products/999")
    assert response.status_code == 404


def test_update_product():
    payload = {
        "name": "Widget A Updated",
        "price": 24.99
    }
    response = client.put("/products/1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Widget A Updated"
    assert data["price"] == 24.99


def test_create_category():
    payload = {"name": "Electronics"}
    response = client.post("/categories", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Electronics"
    assert "id" in data


def test_duplicate_category():
    payload = {"name": "Electronics"}
    response = client.post("/categories", json=payload)
    assert response.status_code == 409


def test_list_categories():
    response = client.get("/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_category():
    response = client.get("/categories/1")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Electronics"


def test_update_category():
    payload = {"name": "Consumer Electronics"}
    response = client.put("/categories/1", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Consumer Electronics"


def test_assign_product_to_category():
    response = client.post("/categories/1/products/1")
    assert response.status_code == 201
    data = response.json()
    assert data["category_id"] == 1
    assert data["product_id"] == 1


def test_duplicate_product_category_assignment():
    response = client.post("/categories/1/products/1")
    assert response.status_code == 409


def test_list_products_by_category():
    response = client.get("/categories/1/products")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == 1


def test_remove_product_from_category():
    response = client.delete("/categories/1/products/1")
    assert response.status_code == 200


def test_delete_product():
    response = client.delete("/products/1")
    assert response.status_code == 200
    get_res = client.get("/products/1")
    assert get_res.status_code == 404


def test_delete_category():
    response = client.delete("/categories/1")
    assert response.status_code == 200
    get_res = client.get("/categories/1")
    assert get_res.status_code == 404
