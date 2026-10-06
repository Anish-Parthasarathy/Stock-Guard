import pytest
import uuid
from datetime import datetime, timezone, timedelta


@pytest.fixture
def order_and_stock(client, seeded_warehouse, seeded_user):
    # 1. Product
    prod = client.post("/products", json={
        "sku": f"DEL-{uuid.uuid4().hex[:5].upper()}",
        "name": "Delivery Test Product",
        "price": 60.0,
        "description": "Item for delivery and returns"
    }).json()

    # 2. Stock
    client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": prod["id"],
        "quantity": 100,
        "reorder_threshold": 10
    })

    # 3. Order
    order = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-DEL-{uuid.uuid4().hex[:6].upper()}",
        "items": [{"product_id": prod["id"], "quantity": 10, "unit_price": 60.0}]
    }).json()

    # 4. Pay order
    client.post(f"/orders/{order['id']}/payments", json={
        "amount": 600.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": f"PAY-{uuid.uuid4().hex}"
    })

    paid_order = client.get(f"/orders/{order['id']}").json()
    return paid_order, prod


def test_delivery_workflow(client, seeded_user, order_and_stock):
    order, _ = order_and_stock
    sched_time = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    # 1. Schedule delivery
    del_res = client.post("/deliveries", json={
        "order_id": order["id"],
        "agent_id": seeded_user.id,
        "scheduled_at": sched_time,
        "delivery_address": "456 Commerce Blvd",
        "delivery_for": "Customer A",
        "delivered_to": ""
    })
    assert del_res.status_code == 201
    delivery = del_res.json()
    assert delivery["order_id"] == order["id"]
    assert delivery["status"] == "SCHEDULED"

    # 2. Update status to DELIVERED
    update_res = client.patch(f"/deliveries/{delivery['id']}/status", json={
        "status": "DELIVERED",
        "delivered_to": "Customer A in person"
    })
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "DELIVERED"

    # 3. Verify Order status transitioned to DELIVERED
    order_check = client.get(f"/orders/{order['id']}").json()
    assert order_check["order_status"] == "DELIVERED"


def test_order_cancellation_with_refund_and_restock(client, seeded_warehouse):
    # Setup a new paid order
    prod = client.post("/products", json={
        "sku": f"CAN-{uuid.uuid4().hex[:5].upper()}",
        "name": "Cancel Test Item",
        "price": 50.0,
        "description": "Item to be cancelled"
    }).json()

    client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": prod["id"],
        "quantity": 50,
        "reorder_threshold": 5
    })

    order = client.post("/orders", json={
        "warehouse_id": seeded_warehouse.id,
        "external_reference_id": f"EXT-CAN-{uuid.uuid4().hex[:6].upper()}",
        "items": [{"product_id": prod["id"], "quantity": 10, "unit_price": 50.0}]
    }).json()

    client.post(f"/orders/{order['id']}/payments", json={
        "amount": 500.0,
        "payment_mode": "CREDIT_CARD",
        "idempotency_key": f"PAY-CAN-{uuid.uuid4().hex}"
    })

    # Stock is now 50 - 10 = 40
    assert client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}").json()["quantity"] == 40

    # Cancel the order (Atomic: cancellation record + refund ledger + inventory restoration)
    cancel_res = client.post(f"/orders/{order['id']}/cancel", json={
        "reason": "Customer changed mind before dispatch"
    })
    assert cancel_res.status_code == 200
    cancellation = cancel_res.json()
    assert cancellation["order_id"] == order["id"]
    assert cancellation["status"] == "CANCELLED"

    # Verify inventory was restored back to 50
    restocked = client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}").json()
    assert restocked["quantity"] == 50

    # Verify Order is CANCELLED
    assert client.get(f"/orders/{order['id']}").json()["order_status"] == "CANCELLED"


def test_return_processing_workflow(client, seeded_warehouse, order_and_stock):
    order, prod = order_and_stock
    # order is already marked DELIVERED from test_delivery_workflow

    item_id = order["items"][0]["id"]
    # Stock before return
    stock_before = client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}").json()["quantity"]

    # 1. Initiate return request
    ret_res = client.post("/returns", json={
        "order_id": order["id"],
        "reason": "Wrong item variant delivered",
        "return_type": "REFUND",
        "items": [
            {
                "order_contains_id": item_id,
                "product_id": prod["id"],
                "warehouse_id": seeded_warehouse.id,
                "quantity_expected": 2,
                "return_unit_price": 60.0
            }
        ]
    })
    assert ret_res.status_code == 201
    ret = ret_res.json()
    assert ret["order_id"] == order["id"]
    assert len(ret["items"]) == 1
    return_contains_id = ret["items"][0]["id"]

    # 2. Receive and inspect return (Atomic: inspection receipt + restock if GOOD + refund)
    rcv_res = client.post(f"/returns/{ret['id']}/receive", json={
        "return_contains_id": return_contains_id,
        "quantity_received": 2,
        "condition_status": "GOOD",
        "condition_notes": "Unopened, factory seal intact",
        "status": "RESTOCKED"
    })
    assert rcv_res.status_code == 201
    receipt = rcv_res.json()
    assert receipt["return_id"] == ret["id"]
    assert receipt["quantity_received"] == 2
    assert receipt["condition_status"] == "GOOD"

    # 3. Verify Stock incremented by 2
    stock_after = client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}").json()["quantity"]
    assert stock_after == stock_before + 2
