import pytest
import uuid


def test_warehouse_creation_and_retrieval(client):
    wh_name = f"Warehouse-{uuid.uuid4().hex[:4].upper()}"
    wh_loc = f"Location-{uuid.uuid4().hex[:6]}"

    # Create warehouse
    create_res = client.post("/warehouse/warehouses", json={
        "name": wh_name,
        "location": wh_loc,
        "capacity": 25000
    })
    assert create_res.status_code == 200
    wh = create_res.json()
    assert wh["name"] == wh_name
    assert wh["location"] == wh_loc
    assert wh["capacity"] == 25000

    # Retrieve warehouse
    get_res = client.get(f"/warehouse/warehouse?id={wh['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == wh["id"]
