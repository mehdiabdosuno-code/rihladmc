"""Tests for Audit trail — create/update/status_change are logged."""

import pytest
from fastapi.testclient import TestClient
from app.modules.projects.models import Project


class TestAuditLogging:
    def test_project_create_is_logged(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/projects", json={"name": "Audit Test Project"}, headers=auth_headers)
        assert resp.status_code == 201
        project_id = resp.json()["id"]

        audit = client.get(f"/api/audit/project/{project_id}", headers=auth_headers)
        assert audit.status_code == 200
        logs = audit.json()
        assert len(logs) == 1
        assert logs[0]["action"] == "create"
        assert logs[0]["changes"]["name"]["after"] == "Audit Test Project"

    def test_project_update_is_logged(self, client: TestClient, auth_headers: dict, sample_project: Project):
        client.put(f"/api/projects/{sample_project.id}",
                   json={"name": "Circuit Modifié", "destination": "Fès"},
                   headers=auth_headers)

        audit = client.get(f"/api/audit/project/{sample_project.id}", headers=auth_headers)
        logs = audit.json()
        update_log = next((l for l in logs if l["action"] == "update"), None)
        assert update_log is not None
        assert "name" in update_log["changes"]
        assert update_log["changes"]["name"]["after"] == "Circuit Modifié"

    def test_status_change_is_logged(self, client: TestClient, auth_headers: dict, sample_project: Project):
        client.patch(f"/api/projects/{sample_project.id}/status?new_status=in_progress",
                     headers=auth_headers)

        audit = client.get(f"/api/audit/project/{sample_project.id}", headers=auth_headers)
        logs = audit.json()
        status_log = next((l for l in logs if l["action"] == "status_change"), None)
        assert status_log is not None
        assert status_log["changes"]["status"]["before"] == "draft"
        assert status_log["changes"]["status"]["after"] == "in_progress"

    def test_audit_requires_auth(self, client: TestClient, sample_project: Project):
        resp = client.get(f"/api/audit/project/{sample_project.id}")
        assert resp.status_code in (401, 403)

    def test_audit_empty_for_unknown_entity(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/audit/project/00000000-0000-0000-0000-000000000000",
                          headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_multiple_changes_ordered_newest_first(self, client: TestClient, auth_headers: dict, sample_project: Project):
        client.put(f"/api/projects/{sample_project.id}", json={"name": "V1"}, headers=auth_headers)
        client.put(f"/api/projects/{sample_project.id}", json={"name": "V2"}, headers=auth_headers)
        client.put(f"/api/projects/{sample_project.id}", json={"name": "V3"}, headers=auth_headers)

        logs = client.get(f"/api/audit/project/{sample_project.id}", headers=auth_headers).json()
        update_logs = [l for l in logs if l["action"] == "update"]
        assert len(update_logs) == 3
        # Newest first
        assert update_logs[0]["changes"]["name"]["after"] == "V3"
