import pytest


@pytest.fixture(scope="module")
def phase2_products():
    """Seed test products specifically for Phase 2 tests (idempotent)."""
    from app.core.database import SessionLocal
    from app.modules.module import Product
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        p1 = db.query(Product).filter_by(sku="SKU-PH2-101").first()
        if not p1:
            p1 = Product(
                sku="SKU-PH2-101",
                name="Phase 2 Item Alpha",
                price=50.0,
                description="Alpha test item",
                updated_at=datetime.now(timezone.utc)
            )
            db.add(p1)
            db.commit()
            db.refresh(p1)

        p2 = db.query(Product).filter_by(sku="SKU-PH2-102").first()
        if not p2:
            p2 = Product(
                sku="SKU-PH2-102",
                name="Phase 2 Item Beta",
                price=80.0,
                description="Beta test item",
                updated_at=datetime.now(timezone.utc)
            )
            db.add(p2)
            db.commit()
            db.refresh(p2)

        return {"id": p1.id, "sku": p1.sku}, {"id": p2.id, "sku": p2.sku}
    finally:
        db.close()


def test_unauthorized_stock_access(unauth_client, seeded_warehouse):
    """Verifies that requests without authentication receive 401."""
    response = unauth_client.get("/stock")
    assert response.status_code == 401


def test_create_stock(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "quantity": 20,
        "reorder_threshold": 5
    }
    response = client.post("/stock", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["warehouse_id"] == seeded_warehouse.id
    assert data["product_id"] == p1["id"]
    assert data["quantity"] == 20
    assert data["reorder_threshold"] == 5
    assert data["version"] == 1
    assert "id" in data
    assert "updated_at" in data


def test_duplicate_stock_conflict(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "quantity": 10,
        "reorder_threshold": 5
    }
    response = client.post("/stock", json=payload)
    assert response.status_code == 409


def test_create_stock_nonexistent_warehouse(client, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": 99999,
        "product_id": p1["id"],
        "quantity": 10,
        "reorder_threshold": 5
    }
    response = client.post("/stock", json=payload)
    assert response.status_code == 404


def test_create_stock_nonexistent_product(client, seeded_warehouse):
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": 99999,
        "quantity": 10,
        "reorder_threshold": 5
    }
    response = client.post("/stock", json=payload)
    assert response.status_code == 404


def test_get_stock_by_warehouse_and_product(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    response = client.get(f"/stock/{seeded_warehouse.id}/{p1['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["warehouse_id"] == seeded_warehouse.id
    assert data["product_id"] == p1["id"]
    assert data["quantity"] == 20


def test_get_nonexistent_stock(client, seeded_warehouse):
    response = client.get(f"/stock/{seeded_warehouse.id}/99999")
    assert response.status_code == 404


def test_list_stock(client, seeded_warehouse):
    response = client.get("/stock")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # Filter by warehouse_id
    res_wh = client.get(f"/stock?warehouse_id={seeded_warehouse.id}")
    assert res_wh.status_code == 200
    assert len(res_wh.json()) >= 1

    # Filter by non-existent warehouse
    res_empty = client.get("/stock?warehouse_id=99999")
    assert res_empty.status_code == 200
    assert len(res_empty.json()) == 0


def test_stock_adjustment_up(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "adjustment_type": "ADJUSTMENT_UP",
        "quantity": 15,
        "notes": "Cycle count addition"
    }
    response = client.post("/stock/adjust", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 35  # 20 + 15
    assert data["version"] == 2


def test_stock_adjustment_down(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "adjustment_type": "ADJUSTMENT_DOWN",
        "quantity": 10,
        "notes": "Damaged goods write-off"
    }
    response = client.post("/stock/adjust", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 25  # 35 - 10
    assert data["version"] == 3


def test_stock_adjustment_down_insufficient(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "adjustment_type": "ADJUSTMENT_DOWN",
        "quantity": 500  # Current is 25
    }
    response = client.post("/stock/adjust", json=payload)
    assert response.status_code == 400

    # Verify state was not modified
    stock_res = client.get(f"/stock/{seeded_warehouse.id}/{p1['id']}")
    assert stock_res.json()["quantity"] == 25
    assert stock_res.json()["version"] == 3


def test_stock_adjustment_optimistic_locking_conflict(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "adjustment_type": "ADJUSTMENT_UP",
        "quantity": 5,
        "expected_version": 1  # current version is 3
    }
    response = client.post("/stock/adjust", json=payload)
    assert response.status_code == 409

    # Verify state was preserved
    stock_res = client.get(f"/stock/{seeded_warehouse.id}/{p1['id']}")
    assert stock_res.json()["quantity"] == 25
    assert stock_res.json()["version"] == 3


def test_stock_adjustment_with_matching_expected_version(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "adjustment_type": "ADJUSTMENT_UP",
        "quantity": 5,
        "expected_version": 3  # matches current version
    }
    response = client.post("/stock/adjust", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["quantity"] == 30  # 25 + 5
    assert data["version"] == 4


def test_stock_ledger_query(client, seeded_warehouse, phase2_products):
    p1, _ = phase2_products
    response = client.get(f"/stock/ledger?warehouse_id={seeded_warehouse.id}&product_id={p1['id']}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Recorded initial creation + adjustments
    assert len(data) >= 3

    # Check the latest ledger entry (ADJUSTMENT_UP of 5)
    latest = data[0]
    assert latest["warehouse_id"] == seeded_warehouse.id
    assert latest["product_id"] == p1["id"]
    assert latest["change_quantity"] == 5
    assert latest["transaction_type"] == "ADJUSTMENT_UP"
    assert latest["reference_type"] == "MANUAL_ADJUSTMENT"


def test_low_stock_filter(client, seeded_warehouse, phase2_products):
    _, p2 = phase2_products
    payload = {
        "warehouse_id": seeded_warehouse.id,
        "product_id": p2["id"],
        "quantity": 2,
        "reorder_threshold": 10
    }
    create_res = client.post("/stock", json=payload)
    assert create_res.status_code == 201

    response = client.get("/stock?low_stock=true")
    assert response.status_code == 200
    low_stocks = response.json()
    assert any(s["product_id"] == p2["id"] for s in low_stocks)
    # p1 has quantity 30 and threshold 5, so it should not be in low_stocks
    p1_id = phase2_products[0]["id"]
    assert not any(s["product_id"] == p1_id for s in low_stocks)
