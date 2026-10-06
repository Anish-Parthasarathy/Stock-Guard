import pytest


def test_create_product(client):
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


def test_duplicate_product_sku(client):
    payload = {
        "sku": "SKU-001",
        "name": "Widget Duplicate",
        "price": 25.0,
        "description": "Duplicate"
    }
    response = client.post("/products", json=payload)
    assert response.status_code == 409


def test_list_products(client):
    response = client.get("/products")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_product(client):
    # Fetch list first to get valid created product ID
    list_res = client.get("/products")
    prod_id = list_res.json()[0]["id"]

    response = client.get(f"/products/{prod_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == prod_id
    assert data["sku"] == "SKU-001"


def test_get_nonexistent_product(client):
    response = client.get("/products/99999")
    assert response.status_code == 404


def test_update_product(client):
    list_res = client.get("/products")
    prod_id = list_res.json()[0]["id"]

    payload = {
        "name": "Widget A Updated",
        "price": 24.99
    }
    response = client.put(f"/products/{prod_id}", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Widget A Updated"
    assert data["price"] == 24.99


def test_create_category(client):
    payload = {"name": "Electronics"}
    response = client.post("/categories", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Electronics"
    assert "id" in data


def test_duplicate_category(client):
    payload = {"name": "Electronics"}
    response = client.post("/categories", json=payload)
    assert response.status_code == 409


def test_list_categories(client):
    response = client.get("/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_category(client):
    cat_res = client.get("/categories")
    cat_id = cat_res.json()[0]["id"]

    response = client.get(f"/categories/{cat_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Electronics"


def test_update_category(client):
    cat_res = client.get("/categories")
    cat_id = cat_res.json()[0]["id"]

    payload = {"name": "Consumer Electronics"}
    response = client.put(f"/categories/{cat_id}", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Consumer Electronics"


def test_assign_product_to_category(client):
    prod_id = client.get("/products").json()[0]["id"]
    cat_id = client.get("/categories").json()[0]["id"]

    response = client.post(f"/categories/{cat_id}/products/{prod_id}")
    assert response.status_code == 201
    data = response.json()
    assert data["category_id"] == cat_id
    assert data["product_id"] == prod_id


def test_duplicate_product_category_assignment(client):
    prod_id = client.get("/products").json()[0]["id"]
    cat_id = client.get("/categories").json()[0]["id"]

    response = client.post(f"/categories/{cat_id}/products/{prod_id}")
    assert response.status_code == 409


def test_list_products_by_category(client):
    cat_id = client.get("/categories").json()[0]["id"]

    response = client.get(f"/categories/{cat_id}/products")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_remove_product_from_category(client):
    prod_id = client.get("/products").json()[0]["id"]
    cat_id = client.get("/categories").json()[0]["id"]

    response = client.delete(f"/categories/{cat_id}/products/{prod_id}")
    assert response.status_code == 200


def test_delete_product(client):
    prod_id = client.get("/products").json()[0]["id"]

    response = client.delete(f"/products/{prod_id}")
    assert response.status_code == 200
    get_res = client.get(f"/products/{prod_id}")
    assert get_res.status_code == 404


def test_delete_category(client):
    cat_id = client.get("/categories").json()[0]["id"]

    response = client.delete(f"/categories/{cat_id}")
    assert response.status_code == 200
    get_res = client.get(f"/categories/{cat_id}")
    assert get_res.status_code == 404
