"""Tests for the Admin module — user management, roles, stats, audit log."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.auth.models import User, Role, RoleEnum
from app.core.security import verify_password


class TestAdminUserList:
    """GET /api/admin/users"""

    def test_requires_admin_role(self, client: TestClient, designer_headers: dict):
        """Travel designer should NOT access admin endpoints."""
        resp = client.get("/api/admin/users", headers=designer_headers)
        assert resp.status_code == 403

    def test_list_users_as_admin(self, client: TestClient, auth_headers: dict, admin_user: User):
        resp = client.get("/api/admin/users", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(u["email"] == "admin@stours.ma" for u in data)

    def test_list_filter_active(self, client: TestClient, auth_headers: dict, admin_user: User):
        resp = client.get("/api/admin/users?is_active=true", headers=auth_headers)
        assert resp.status_code == 200
        assert all(u["is_active"] for u in resp.json())

    def test_list_search(self, client: TestClient, auth_headers: dict, admin_user: User):
        resp = client.get("/api/admin/users?search=admin", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestAdminUserCreate:
    """POST /api/admin/users"""

    def test_create_user_success(
        self, client: TestClient, auth_headers: dict, admin_role: Role, designer_role: Role
    ):
        resp = client.post("/api/admin/users", json={
            "email": "newuser@stours.ma",
            "full_name": "New User Test",
            "password": "Secure1234!",
            "role_name": "travel_designer",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@stours.ma"
        assert data["role_name"] == "travel_designer"

    def test_create_duplicate_email(
        self, client: TestClient, auth_headers: dict, admin_user: User
    ):
        resp = client.post("/api/admin/users", json={
            "email": "admin@stours.ma",  # already exists
            "full_name": "Duplicate",
            "password": "Test1234!",
            "role_name": "super_admin",
        }, headers=auth_headers)
        assert resp.status_code == 409

    def test_create_invalid_role(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/admin/users", json={
            "email": "test@stours.ma",
            "full_name": "Test",
            "password": "Test1234!",
            "role_name": "ghost_role",
        }, headers=auth_headers)
        assert resp.status_code == 422

    def test_short_password_rejected(
        self, client: TestClient, auth_headers: dict, designer_role: Role
    ):
        resp = client.post("/api/admin/users", json={
            "email": "weak@stours.ma",
            "full_name": "Weak Password",
            "password": "abc",
            "role_name": "travel_designer",
        }, headers=auth_headers)
        assert resp.status_code == 422


class TestAdminUserUpdate:
    """PUT /api/admin/users/{id}"""

    def test_update_full_name(
        self, client: TestClient, auth_headers: dict, admin_user: User, admin_role: Role
    ):
        resp = client.put(f"/api/admin/users/{admin_user.id}", json={
            "full_name": "Updated Name",
            "role_name": "super_admin",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    def test_update_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.put("/api/admin/users/00000000-0000-0000-0000-000000000000", json={
            "full_name": "Ghost",
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestAdminUserStatus:
    """PATCH /api/admin/users/{id}/status"""

    def test_deactivate_user(
        self, client: TestClient, auth_headers: dict, admin_user: User, db: Session
    ):
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}/status",
            params={"is_active": "false"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        db.refresh(admin_user)
        assert admin_user.is_active is False

    def test_reactivate_user(
        self, client: TestClient, auth_headers: dict, admin_user: User, db: Session
    ):
        admin_user.is_active = False
        db.commit()
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}/status",
            params={"is_active": "true"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        db.refresh(admin_user)
        assert admin_user.is_active is True


class TestAdminPasswordReset:
    """PATCH /api/admin/users/{id}/password"""

    def test_reset_password(
        self, client: TestClient, auth_headers: dict, admin_user: User, db: Session
    ):
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}/password",
            json={"new_password": "NewSecure5678!"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        db.refresh(admin_user)
        assert verify_password("NewSecure5678!", admin_user.password_hash)

    def test_short_password_rejected(
        self, client: TestClient, auth_headers: dict, admin_user: User
    ):
        resp = client.patch(
            f"/api/admin/users/{admin_user.id}/password",
            json={"new_password": "tiny"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestAdminRoles:
    """GET /api/admin/roles and POST /api/admin/roles/initialize"""

    def test_list_roles(
        self, client: TestClient, auth_headers: dict, admin_role: Role
    ):
        resp = client.get("/api/admin/roles", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_initialize_roles(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/admin/roles/initialize", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "created" in data

    def test_initialize_roles_idempotent(self, client: TestClient, auth_headers: dict):
        """Calling twice should not fail or duplicate roles."""
        client.post("/api/admin/roles/initialize", headers=auth_headers)
        resp = client.post("/api/admin/roles/initialize", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["created"] == []  # nothing new on second call


class TestAdminStats:
    """GET /api/admin/stats"""

    def test_stats_structure(
        self, client: TestClient, auth_headers: dict, admin_user: User
    ):
        resp = client.get("/api/admin/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "projects" in data
        assert "quotations" in data
        assert data["users"]["total"] >= 1
        assert data["users"]["active"] >= 1


class TestAdminAuditLog:
    """GET /api/admin/audit"""

    def test_audit_log_accessible(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/admin/audit", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_audit_generated_on_create(
        self, client: TestClient, auth_headers: dict, designer_role: Role
    ):
        """Creating a user should generate an audit entry."""
        client.post("/api/admin/users", json={
            "email": "audit_test@stours.ma",
            "full_name": "Audit Test",
            "password": "Audit1234!",
            "role_name": "travel_designer",
        }, headers=auth_headers)

        resp = client.get("/api/admin/audit?action=create&entity_type=User", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
