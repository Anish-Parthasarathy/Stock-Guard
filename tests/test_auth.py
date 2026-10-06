import pytest
from app.core.security import create_refresh_token


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

