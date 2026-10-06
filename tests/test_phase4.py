import pytest
import uuid


@pytest.fixture
def product_with_stock(client, seeded_warehouse):
    # 1. Create product with SKU length <= 12
    res = client.post("/products", json={
        "sku": f"ORD-{uuid.uuid4().hex[:5].upper()}",
        "name": "Orderable Test Item",
        "price": 100.0,
        "description": "Item for testing customer orders"
    })
    assert res.status_code == 201
    prod = res.json()

    # 2. Add 50 units into stock
    stock_res = client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": prod["id"],
        "quantity": 50,
        "reorder_threshold": 5
    })
    assert stock_res.status_code == 201

    return prod



def test_order_checkout_reservation_and_payment(client, seeded_warehouse, product_with_stock):
    prod = product_with_stock

    # 1. Place order (reserves 5 units)
    order_payload = {
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-{uuid.uuid4().hex[:8].upper()}",
        "items": [
            {
                "product_id": prod["id"],
                "quantity": 5,
                "unit_price": 100.0
            }
        ]
    }
    order_res = client.post("/orders", json=order_payload)
    assert order_res.status_code == 201
    order = order_res.json()
    assert order["order_status"] == "PENDING"
    assert order["payment_status"] == "PENDING"
    assert order["total_amount"] == 500.0
    assert len(order["items"]) == 1
    assert len(order["reservations"]) == 1
    assert order["reservations"][0]["status"] == "RESERVED"

    # 2. Query order
    get_res = client.get(f"/orders/{order['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == order["id"]

    # 3. Pay for order (Atomic settlement: Financial ledger + deduct stock)
    pay_key = f"PAY-{uuid.uuid4().hex}"
    pay_payload = {
        "amount": 500.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": pay_key
    }
    pay_res = client.post(f"/orders/{order['id']}/payments", json=pay_payload)
    assert pay_res.status_code == 201
    payment = pay_res.json()
    assert payment["order_id"] == order["id"]
    assert payment["status"] == "SUCCESS"
    assert payment["amount"] == 500.0

    # 4. Check updated order status
    order_after_pay = client.get(f"/orders/{order['id']}").json()
    assert order_after_pay["order_status"] == "CONFIRMED"
    assert order_after_pay["payment_status"] == "PAID"
    assert order_after_pay["reservations"][0]["status"] == "FULFILLED"

    # 5. Check stock deducted from 50 to 45
    stock_res = client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}")
    assert stock_res.status_code == 200
    assert stock_res.json()["quantity"] == 45

    # 6. Check financial ledger query
    fin_res = client.get("/financial-ledger")
    assert fin_res.status_code == 200
    assert any(entry["idempotency_key"] == pay_key for entry in fin_res.json())


def test_order_overselling_prevention(client, seeded_warehouse, product_with_stock):
    prod = product_with_stock
    # Current available stock is 45 (or 50). Try ordering 9999 units.
    order_payload = {
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-FAIL-{uuid.uuid4().hex[:6].upper()}",
        "items": [
            {
                "product_id": prod["id"],
                "quantity": 9999,
                "unit_price": 100.0
            }
        ]
    }
    order_res = client.post("/orders", json=order_payload)
    assert order_res.status_code == 400


def test_release_reservation(client, seeded_warehouse, product_with_stock):
    prod = product_with_stock

    # Create order reserving 10 units
    order_res = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-REL-{uuid.uuid4().hex[:6].upper()}",
        "items": [{"product_id": prod["id"], "quantity": 10, "unit_price": 100.0}]
    })
    assert order_res.status_code == 201
    order = order_res.json()

    # Release reservations
    rel_res = client.post(f"/orders/{order['id']}/release-reservation")
    assert rel_res.status_code == 200

    # Check reservation status marked RELEASED
    check_order = client.get(f"/orders/{order['id']}").json()
    assert check_order["reservations"][0]["status"] == "RELEASED"


