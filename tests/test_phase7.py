import pytest
import uuid


@pytest.fixture
def analytics_seed(client, seeded_warehouse):
    # 1. Product 1 (Normal stock)
    p1 = client.post("/products", json={
        "sku": f"AN1-{uuid.uuid4().hex[:5].upper()}",
        "name": "Analytics Item 1",
        "price": 100.0,
        "description": "Item for analytics testing"
    }).json()

    client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": p1["id"],
        "quantity": 80,
        "reorder_threshold": 20
    })

    # 2. Product 2 (Low stock)
    p2 = client.post("/products", json={
        "sku": f"AN2-{uuid.uuid4().hex[:5].upper()}",
        "name": "Analytics Item 2",
        "price": 50.0,
        "description": "Item for low stock testing"
    }).json()

    client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": p2["id"],
        "quantity": 5,
        "reorder_threshold": 25
    })

    return p1, p2


def test_warehouse_capacity_analytics(client, seeded_warehouse, analytics_seed):
    # Query all warehouses
    res = client.get("/analytics/warehouse-capacity")
    assert res.status_code == 200
    metrics = res.json()
    assert isinstance(metrics, list)
    assert len(metrics) >= 1

    wh_metric = next(m for m in metrics if m["warehouse_id"] == seeded_warehouse.id)
    assert wh_metric["capacity"] == seeded_warehouse.capacity
    assert wh_metric["current_stock_quantity"] >= 85
    assert wh_metric["utilization_rate"] > 0.0
    assert wh_metric["distinct_products"] >= 2

    # Query specific warehouse filter
    res_filtered = client.get(f"/analytics/warehouse-capacity?warehouse_id={seeded_warehouse.id}")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()) == 1
    assert res_filtered.json()[0]["warehouse_id"] == seeded_warehouse.id


def test_low_stock_analytics(client, seeded_warehouse, analytics_seed):
    _, p2 = analytics_seed

    res = client.get(f"/analytics/low-stock?warehouse_id={seeded_warehouse.id}")
    assert res.status_code == 200
    alerts = res.json()
    assert isinstance(alerts, list)
    # p2 has quantity 5 and threshold 25, so it must be present
    assert any(a["product_id"] == p2["id"] for a in alerts)
    alert = next(a for a in alerts if a["product_id"] == p2["id"])
    assert alert["current_quantity"] == 5
    assert alert["reorder_threshold"] == 25
    assert alert["deficit"] == 20


def test_dead_stock_analytics(client, seeded_warehouse, analytics_seed):
    # Query dead stock with 1 day threshold
    res = client.get(f"/analytics/dead-stock?days=1&warehouse_id={seeded_warehouse.id}")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)


def test_fulfillment_metrics_analytics(client, seeded_warehouse):
    res = client.get(f"/analytics/fulfillment-metrics?warehouse_id={seeded_warehouse.id}")
    assert res.status_code == 200
    metrics = res.json()
    assert "total_orders" in metrics
    assert "delivered_orders" in metrics
    assert "cancelled_orders" in metrics
    assert "returned_orders" in metrics
    assert "total_revenue" in metrics
    assert "total_refunded" in metrics
    assert "fulfillment_rate" in metrics
    assert "cancellation_rate" in metrics
    assert "return_rate" in metrics


def test_supplier_performance_analytics(client):
    res = client.get("/analytics/supplier-performance")
    assert res.status_code == 200
    perf = res.json()
    assert isinstance(perf, list)
    if len(perf) > 0:
        sup = perf[0]
        assert "supplier_id" in sup
        assert "supplier_name" in sup
        assert "total_purchase_orders" in sup
        assert "completed_purchase_orders" in sup
        assert "fulfillment_rate" in sup
