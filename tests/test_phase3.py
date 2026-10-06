import pytest
from datetime import datetime, timezone, timedelta


@pytest.fixture
def supplier_and_product(client, seeded_warehouse):
    # Create product for supplier
    prod = client.post("/products", json={
        "sku": "SKU-PO-001",
        "name": "Supplier Item 1",
        "price": 40.0,
        "description": "Item for procurement"
    }).json()

    # Create supplier
    sup = client.post("/suppliers", json={
        "name": "Global Supplies Ltd",
        "email": "contact@globalsupplies.test",
        "phone": "+1-555-0199"
    }).json()

    # Associate product with supplier
    client.post(f"/suppliers/{sup['id']}/products", json={
        "product_id": prod["id"],
        "supplier_sku": "GS-001",
        "unit_price": 30.0,
        "time_required_in_days": 3
    })

    return sup, prod


def test_supplier_crud(client):
    sup_res = client.post("/suppliers", json={
        "name": "Acme Industrial",
        "email": "info@acme.test",
        "phone": "+1-555-0100"
    })
    assert sup_res.status_code == 201
    sup = sup_res.json()
    assert sup["name"] == "Acme Industrial"

    # Get by ID
    get_res = client.get(f"/suppliers/{sup['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Acme Industrial"

    # Update
    put_res = client.put(f"/suppliers/{sup['id']}", json={"name": "Acme Global Industrial"})
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "Acme Global Industrial"

    # Delete
    del_res = client.delete(f"/suppliers/{sup['id']}")
    assert del_res.status_code == 200
    assert client.get(f"/suppliers/{sup['id']}").status_code == 404


def test_create_and_process_purchase_order(client, seeded_warehouse, supplier_and_product):
    sup, prod = supplier_and_product
    exp_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    # 1. Create Purchase Order
    po_payload = {
        "supplier_id": sup["id"],
        "is_auto_generated": False,
        "items": [
            {
                "product_id": prod["id"],
                "warehouse_id": seeded_warehouse.id,
                "quantity_ordered": 50,
                "unit_price": 30.0,
                "expected_date": exp_date
            }
        ]
    }
    po_res = client.post("/purchase-orders", json=po_payload)
    assert po_res.status_code == 201
    po = po_res.json()
    assert po["supplier_id"] == sup["id"]
    assert po["approved_status"] == "PENDING_APPROVAL"
    assert po["status"] == "NOT_ISSUED"
    assert len(po["items"]) == 1
    contains_id = po["items"][0]["id"]

    # 2. Approve Purchase Order
    appr_res = client.patch(f"/purchase-orders/{po['id']}/approval", json={"approved_status": "APPROVED"})
    assert appr_res.status_code == 200
    assert appr_res.json()["approved_status"] == "APPROVED"

    # 3. Advance Status to ISSUED_TO_VENDOR
    status_res = client.patch(f"/purchase-orders/{po['id']}/status", json={"status": "ISSUED_TO_VENDOR"})
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "ISSUED_TO_VENDOR"

    # 4. Receive Purchase Order (Inbound Goods Receipt)
    rcv_payload = {
        "purchase_order_contains_id": contains_id,
        "quantity_received": 50,
        "condition_notes": "All 50 units in perfect condition"
    }
    rcv_res = client.post(f"/purchase-orders/{po['id']}/receive", json=rcv_payload)
    assert rcv_res.status_code == 201
    receipt = rcv_res.json()
    assert receipt["purchase_order_id"] == po["id"]
    assert receipt["quantity_received"] == 50

    # Verify PO status updated to FULLY_RECEIVED
    po_get = client.get(f"/purchase-orders/{po['id']}")
    assert po_get.status_code == 200
    assert po_get.json()["status"] == "FULLY_RECEIVED"

    # 5. Verify Warehouse Stock incremented
    stock_res = client.get(f"/stock/{seeded_warehouse.id}/{prod['id']}")
    assert stock_res.status_code == 200
    assert stock_res.json()["quantity"] >= 50

