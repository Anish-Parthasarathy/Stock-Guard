import pytest
import uuid
from datetime import datetime, timezone, timedelta
from app.modules.module import Warehouse


@pytest.fixture
def transfer_setup(client, seeded_warehouse, db):
    # 1. Create a destination warehouse
    dest_wh = Warehouse(
        name=f"Dest Hub {uuid.uuid4().hex[:4]}",
        location="Zone 2, North Terminal",
        capacity=50000,
        created_at=datetime.now(timezone.utc).date()
    )
    db.add(dest_wh)
    db.commit()
    db.refresh(dest_wh)

    # 2. Create product
    prod = client.post("/products", json={
        "sku": f"TRF-{uuid.uuid4().hex[:5].upper()}",
        "name": "Transferable Item",
        "price": 75.0,
        "description": "Item for testing transfers"
    }).json()

    # 3. Seed source stock (100 units)
    client.post("/stock", json={
        "warehouse_id": seeded_warehouse.id,
        "product_id": prod["id"],
        "quantity": 100,
        "reorder_threshold": 10
    })

    return seeded_warehouse, dest_wh, prod


def test_intra_warehouse_transfer_lifecycle(client, transfer_setup):
    src_wh, dest_wh, prod = transfer_setup
    exp_completion = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # 1. Dispatch Transfer of 30 units
    transfer_payload = {
        "source_warehouse_id": src_wh.id,
        "destination_warehouse_id": dest_wh.id,
        "transport_mode": "ROAD",
        "expected_completion": exp_completion,
        "items": [
            {
                "product_id": prod["id"],
                "quantity_dispatched": 30
            }
        ]
    }
    create_res = client.post("/transfers", json=transfer_payload)
    assert create_res.status_code == 201
    transfer = create_res.json()
    assert transfer["source_warehouse_id"] == src_wh.id
    assert transfer["destination_warehouse_id"] == dest_wh.id
    assert transfer["status"] == "IN_TRANSIT"
    assert len(transfer["items"]) == 1
    transfer_item_id = transfer["items"][0]["id"]

    # 2. Verify source stock deducted (100 - 30 = 70)
    src_stock = client.get(f"/stock/{src_wh.id}/{prod['id']}").json()
    assert src_stock["quantity"] == 70

    # 3. Query transfer details
    get_res = client.get(f"/transfers/{transfer['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == transfer["id"]

    # 4. Receive Transfer at Destination
    receive_payload = {
        "transfer_contains_id": transfer_item_id,
        "quantity_received": 30,
        "status": "RECEIVED"
    }
    rcv_res = client.post(f"/transfers/{transfer['id']}/receive", json=receive_payload)
    assert rcv_res.status_code == 201
    receipt = rcv_res.json()
    assert receipt["transfer_id"] == transfer["id"]
    assert receipt["quantity_received"] == 30

    # 5. Verify destination stock created/incremented (+30)
    dest_stock = client.get(f"/stock/{dest_wh.id}/{prod['id']}")
    assert dest_stock.status_code == 200
    assert dest_stock.json()["quantity"] == 30

    # 6. Verify transfer status advanced to RECEIVED / COMPLETED
    updated_transfer = client.get(f"/transfers/{transfer['id']}").json()
    assert updated_transfer["status"] in ["RECEIVED", "COMPLETED"]


def test_transfer_same_warehouse_validation(client, seeded_warehouse, transfer_setup):
    _, _, prod = transfer_setup
    exp_completion = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    # Sending from warehouse to itself should fail validation
    invalid_payload = {
        "source_warehouse_id": seeded_warehouse.id,
        "destination_warehouse_id": seeded_warehouse.id,
        "transport_mode": "ROAD",
        "expected_completion": exp_completion,
        "items": [{"product_id": prod["id"], "quantity_dispatched": 10}]
    }
    res = client.post("/transfers", json=invalid_payload)
    assert res.status_code == 422
