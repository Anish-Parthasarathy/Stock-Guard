import pytest
import uuid
from fastapi.testclient import TestClient
from app.core.security import create_refresh_token, create_access_token
from app.api.main import app


def test_auth_login_success(unauth_client, seeded_user):
    response = unauth_client.post("/auth/login", data={
        "username": seeded_user.email,
        "password": "Password123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == seeded_user.email
    assert "access_token" in data
    assert "refresh_token" in data


def test_auth_login_invalid_credentials(unauth_client, seeded_user):
    response = unauth_client.post("/auth/login", data={
        "username": seeded_user.email,
        "password": "WrongPassword999"
    })
    assert response.status_code == 401


def test_auth_refresh_token(unauth_client, seeded_user, seeded_warehouse):
    # Generate valid refresh token
    refresh_tok = create_refresh_token(
        email=seeded_user.email,
        role=seeded_user.role,
        warehouse_id=seeded_warehouse.id
    )

    response = unauth_client.post("/auth/refresh", json={"token": refresh_tok})
    assert response.status_code == 200
    token_str = response.json()
    assert isinstance(token_str, str)
    assert len(token_str) > 20


def test_admin_create_user_success(client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    email = f"emp_{unique_id}@stockguard.test"
    payload = {
        "name": f"Employee {unique_id}",
        "email": email,
        "password": "TemporaryPass123!",
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    }
    response = client.post("/auth/users", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == email
    assert data["role"] == "warehouse_staff"
    assert data["warehouse_id"] == seeded_warehouse.id
    assert "password" not in data
    assert "password_hash" not in data
    assert "id" in data


def test_admin_create_user_duplicate_email(client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    email = f"dup_{unique_id}@stockguard.test"
    payload = {
        "name": "Duplicate User",
        "email": email,
        "password": "TemporaryPass123!",
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    }
    # First creation should succeed
    res1 = client.post("/auth/users", json=payload)
    assert res1.status_code == 201

    # Second creation with identical email must return 409 Conflict
    res2 = client.post("/auth/users", json=payload)
    assert res2.status_code == 409


def test_admin_create_user_nonexistent_warehouse(client):
    payload = {
        "name": "Invalid Warehouse User",
        "email": f"bad_wh_{uuid.uuid4().hex[:6]}@stockguard.test",
        "password": "TemporaryPass123!",
        "role": "warehouse_staff",
        "warehouse_id": 999999
    }
    response = client.post("/auth/users", json=payload)
    assert response.status_code == 404


def test_create_user_forbidden_for_non_admin(unauth_client, seeded_warehouse):
    staff_token = create_access_token(
        email="staff@stockguard.test",
        role="warehouse_staff",
        warehouse_id=seeded_warehouse.id
    )
    staff_client = TestClient(app)
    staff_client.headers.update({"Authorization": f"Bearer {staff_token}"})

    payload = {
        "name": "Unauthorized Attempt",
        "email": f"unauth_{uuid.uuid4().hex[:6]}@stockguard.test",
        "password": "TemporaryPass123!",
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    }
    response = staff_client.post("/auth/users", json=payload)
    assert response.status_code == 403


def test_create_user_unauthorized(unauth_client, seeded_warehouse):
    payload = {
        "name": "Anon Attempt",
        "email": f"anon_{uuid.uuid4().hex[:6]}@stockguard.test",
        "password": "TemporaryPass123!",
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    }
    response = unauth_client.post("/auth/users", json=payload)
    assert response.status_code == 401


def test_admin_list_users_and_filters(client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    # Create a manager
    client.post("/auth/users", json={
        "name": f"Manager {unique_id}",
        "email": f"mgr_{unique_id}@stockguard.test",
        "password": "ManagerPass123!",
        "role": "manager",
        "warehouse_id": seeded_warehouse.id
    })

    # List all users
    res_all = client.get("/auth/users")
    assert res_all.status_code == 200
    all_users = res_all.json()
    assert len(all_users) >= 2

    # Filter by role
    res_mgr = client.get("/auth/users?role=manager")
    assert res_mgr.status_code == 200
    mgrs = res_mgr.json()
    assert all(u["role"] == "manager" for u in mgrs)

    # Filter by warehouse_id
    res_wh = client.get(f"/auth/users?warehouse_id={seeded_warehouse.id}")
    assert res_wh.status_code == 200
    wh_users = res_wh.json()
    assert all(u["warehouse_id"] == seeded_warehouse.id for u in wh_users)


def test_list_users_forbidden_for_non_admin(unauth_client, seeded_warehouse):
    staff_token = create_access_token(
        email="staff2@stockguard.test",
        role="warehouse_staff",
        warehouse_id=seeded_warehouse.id
    )
    staff_client = TestClient(app)
    staff_client.headers.update({"Authorization": f"Bearer {staff_token}"})

    response = staff_client.get("/auth/users")
    assert response.status_code == 403


def test_employee_password_change_lifecycle(client, unauth_client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    email = f"emp_{unique_id}@stockguard.test"
    temp_pass = "TemporaryPass123!"
    new_pass = "BrandNewSecurePass999!"

    # 1. Admin provisions employee
    create_res = client.post("/auth/users", json={
        "name": f"Employee {unique_id}",
        "email": email,
        "password": temp_pass,
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    })
    assert create_res.status_code == 201

    # 2. Employee logs in with temporary password
    login_res = unauth_client.post("/auth/login", data={
        "username": email,
        "password": temp_pass
    })
    assert login_res.status_code == 200
    tokens = login_res.json()
    emp_token = tokens["access_token"]

    emp_client = TestClient(app)
    emp_client.headers.update({"Authorization": f"Bearer {emp_token}"})

    # 3. Employee attempts change with wrong old password -> 400
    bad_change_res = emp_client.post("/auth/change-password", json={
        "old_password": "WrongPriorPassword123!",
        "new_password": new_pass
    })
    assert bad_change_res.status_code == 400

    # 4. Employee changes password successfully -> 200
    good_change_res = emp_client.post("/auth/change-password", json={
        "old_password": temp_pass,
        "new_password": new_pass
    })
    assert good_change_res.status_code == 200
    assert "message" in good_change_res.json()

    # 5. Old temporary password fails to log in -> 401
    old_login_res = unauth_client.post("/auth/login", data={
        "username": email,
        "password": temp_pass
    })
    assert old_login_res.status_code == 401

    # 6. New password successfully logs in -> 200
    new_login_res = unauth_client.post("/auth/login", data={
        "username": email,
        "password": new_pass
    })
    assert new_login_res.status_code == 200


def test_admin_reset_password(client, unauth_client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    email = f"reset_emp_{unique_id}@stockguard.test"
    initial_pass = "InitialPass123!"
    override_pass = "AdminOverrideSecret999!"

    # 1. Admin provisions user
    create_res = client.post("/auth/users", json={
        "name": f"Reset User {unique_id}",
        "email": email,
        "password": initial_pass,
        "role": "delivery_agent",
        "warehouse_id": seeded_warehouse.id
    })
    assert create_res.status_code == 201
    user_id = create_res.json()["id"]

    # 2. Admin resets password
    reset_res = client.post(f"/auth/users/{user_id}/reset-password", json={
        "new_password": override_pass
    })
    assert reset_res.status_code == 200

    # 3. User logs in with reset password
    login_res = unauth_client.post("/auth/login", data={
        "username": email,
        "password": override_pass
    })
    assert login_res.status_code == 200

    # 4. Admin reset for non-existent user -> 404
    missing_res = client.post("/auth/users/999999/reset-password", json={
        "new_password": override_pass
    })
    assert missing_res.status_code == 404

    # 5. Non-admin attempting reset -> 403
    staff_token = create_access_token(
        email="staff3@stockguard.test",
        role="warehouse_staff",
        warehouse_id=seeded_warehouse.id
    )
    staff_client = TestClient(app)
    staff_client.headers.update({"Authorization": f"Bearer {staff_token}"})
    non_admin_res = staff_client.post(f"/auth/users/{user_id}/reset-password", json={
        "new_password": override_pass
    })
    assert non_admin_res.status_code == 403


def test_users_direct_mount(client, seeded_warehouse):
    unique_id = uuid.uuid4().hex[:6]
    email = f"direct_{unique_id}@stockguard.test"

    # Test /users direct mount
    create_res = client.post("/users", json={
        "name": f"Direct User {unique_id}",
        "email": email,
        "password": "Password123!",
        "role": "warehouse_staff",
        "warehouse_id": seeded_warehouse.id
    })
    assert create_res.status_code == 201
    user_id = create_res.json()["id"]

    # Test GET /users
    list_res = client.get("/users")
    assert list_res.status_code == 200
    assert any(u["id"] == user_id for u in list_res.json())

    # Test POST /users/{id}/reset-password
    reset_res = client.post(f"/users/{user_id}/reset-password", json={
        "new_password": "NewResetPassword123!"
    })
    assert reset_res.status_code == 200


