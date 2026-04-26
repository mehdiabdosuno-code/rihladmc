"""Tests for authentication flow — login, JWT, me endpoint, invalid credentials."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.auth.models import User, Role, RoleEnum
from app.core.security import hash_password, decode_access_token


class TestLogin:
    """POST /api/auth/login"""

    def test_login_success(self, client: TestClient, admin_user: User):
        """Valid credentials → 200 + access_token."""
        resp = client.post("/api/auth/login", json={
            "email": "admin@stours.ma",
            "password": "Admin1234!",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, admin_user: User):
        """Wrong password → 401."""
        resp = client.post("/api/auth/login", json={
            "email": "admin@stours.ma",
            "password": "WrongPass!",
        })
        assert resp.status_code == 401

    def test_login_unknown_email(self, client: TestClient, admin_user: User):
        """Unknown email → 401."""
        resp = client.post("/api/auth/login", json={
            "email": "nobody@stours.ma",
            "password": "Admin1234!",
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client: TestClient, db: Session, admin_user: User):
        """Inactive user → 401."""
        admin_user.is_active = False
        db.commit()
        resp = client.post("/api/auth/login", json={
            "email": "admin@stours.ma",
            "password": "Admin1234!",
        })
        assert resp.status_code == 401

    def test_login_returns_valid_jwt(self, client: TestClient, admin_user: User):
        """JWT payload must contain 'sub' claim."""
        resp = client.post("/api/auth/login", json={
            "email": "admin@stours.ma",
            "password": "Admin1234!",
        })
        token = resp.json()["access_token"]
        payload = decode_access_token(token)
        assert payload is not None
        assert payload.get("sub") == admin_user.id


class TestMeEndpoint:
    """GET /api/auth/me — requires valid Bearer token."""

    def test_me_success(self, client: TestClient, admin_user: User, auth_headers: dict):
        """Valid token → 200 with user data."""
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@stours.ma"

    def test_me_no_token(self, client: TestClient):
        """No token → 403 or 401."""
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_me_invalid_token(self, client: TestClient):
        """Garbage token → 401 or 403."""
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert resp.status_code in (401, 403)


class TestPasswordSecurity:
    """Hash and verify utility functions."""

    def test_hash_is_bcrypt(self):
        h = hash_password("test123")
        assert h.startswith("$2b$")

    def test_verify_correct_password(self):
        from app.core.security import verify_password
        h = hash_password("MySecret!")
        assert verify_password("MySecret!", h) is True

    def test_verify_wrong_password(self):
        from app.core.security import verify_password
        h = hash_password("MySecret!")
        assert verify_password("WrongSecret!", h) is False

    def test_unique_hashes(self):
        """Same password must produce different hashes (bcrypt salting)."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2
