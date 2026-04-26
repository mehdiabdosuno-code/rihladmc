"""Tests for Projects CRUD — list, create, get, update, status, delete."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.projects.models import Project, ProjectStatus


VALID_PROJECT = {
    "name": "Circuit Atlas 7J",
    "client_name": "Travel Co",
    "client_email": "travel@co.com",
    "destination": "Fès",
    "duration_days": 7,
    "duration_nights": 6,
    "pax_count": 30,
    "currency": "EUR",
    "project_type": "leisure",
}


class TestProjectList:
    """GET /api/projects"""

    def test_list_requires_auth(self, client: TestClient):
        resp = client.get("/api/projects")
        assert resp.status_code in (401, 403)

    def test_list_empty(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/projects", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_returns_projects(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.get("/api/projects", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == sample_project.name

    def test_list_filter_by_status(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.get("/api/projects?status=draft", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp2 = client.get("/api/projects?status=validated", headers=auth_headers)
        assert resp2.status_code == 200
        assert len(resp2.json()) == 0

    def test_list_search(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.get("/api/projects?search=Marrakech", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp2 = client.get("/api/projects?search=NonExistent", headers=auth_headers)
        assert resp2.status_code == 200
        assert len(resp2.json()) == 0


class TestProjectCreate:
    """POST /api/projects"""

    def test_create_requires_auth(self, client: TestClient):
        resp = client.post("/api/projects", json=VALID_PROJECT)
        assert resp.status_code in (401, 403)

    def test_create_success(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/projects", json=VALID_PROJECT, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Circuit Atlas 7J"
        assert data["status"] == "draft"
        assert "id" in data

    def test_create_minimal(self, client: TestClient, auth_headers: dict):
        """Only name is strictly required."""
        resp = client.post("/api/projects", json={"name": "Minimal Project"}, headers=auth_headers)
        assert resp.status_code == 201

    def test_create_invalid_missing_name(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/projects", json={"destination": "Agadir"}, headers=auth_headers)
        assert resp.status_code == 422


class TestProjectGet:
    """GET /api/projects/{id}"""

    def test_get_success(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.get(f"/api/projects/{sample_project.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_project.id

    def test_get_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/projects/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert resp.status_code == 404


class TestProjectUpdate:
    """PUT /api/projects/{id}"""

    def test_update_success(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        updated = {**VALID_PROJECT, "name": "Circuit Modifié"}
        resp = client.put(
            f"/api/projects/{sample_project.id}", json=updated, headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Circuit Modifié"

    def test_update_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.put(
            "/api/projects/00000000-0000-0000-0000-000000000000",
            json=VALID_PROJECT,
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestProjectStatus:
    """PATCH /api/projects/{id}/status"""

    def test_update_status(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.patch(
            f"/api/projects/{sample_project.id}/status",
            params={"new_status": "validated"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "validated"

    def test_invalid_status(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.patch(
            f"/api/projects/{sample_project.id}/status",
            params={"new_status": "flying_high"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestProjectDelete:
    """DELETE /api/projects/{id}"""

    def test_soft_delete(
        self, client: TestClient, auth_headers: dict, sample_project: Project, db: Session
    ):
        resp = client.delete(f"/api/projects/{sample_project.id}", headers=auth_headers)
        assert resp.status_code == 204

        # Verify soft delete: active=False
        db.refresh(sample_project)
        assert sample_project.active is False

    def test_soft_deleted_not_in_list(
        self, client: TestClient, auth_headers: dict, sample_project: Project, db: Session
    ):
        client.delete(f"/api/projects/{sample_project.id}", headers=auth_headers)
        resp = client.get("/api/projects", headers=auth_headers)
        assert len(resp.json()) == 0


class TestProjectKPIs:
    """GET /api/projects/stats/kpis"""

    def test_kpis_returns_structure(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/projects/stats/kpis", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_projects" in data
        assert "active_projects" in data
        assert "recent_projects_30d" in data
        assert "by_status" in data

    def test_kpis_count_correct(
        self, client: TestClient, auth_headers: dict, sample_project: Project
    ):
        resp = client.get("/api/projects/stats/kpis", headers=auth_headers)
        data = resp.json()
        assert data["total_projects"] == 1
        assert data["by_status"].get("draft") == 1
