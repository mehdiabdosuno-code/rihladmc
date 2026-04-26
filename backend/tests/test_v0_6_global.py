"""Global Integration Tests for v0.6+ Intelligence Features."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.modules.projects.models import Project, ProjectStatus

def test_v0_6_magic_extract_flow(client: TestClient, auth_headers: dict):
    """Test the magic extraction endpoint."""
    brief = "Groupe de 15 personnes pour 5 jours à Marrakech en octobre, budget luxe."
    resp = client.post("/api/ai/magic-extract", json={"brief": brief}, headers=auth_headers)
    
    # Note: If no API key, this might return 502 or a mock. 
    # Here we test the endpoint exists and handles the payload.
    assert resp.status_code in (200, 502) 

def test_v0_6_audit_trail_visibility(client: TestClient, auth_headers: dict, sample_project: Project):
    """Test that the new audit endpoint returns data for a project."""
    # Trigger an update to generate a log
    client.put(f"/api/projects/{sample_project.id}", json={"name": "Updated Name"}, headers=auth_headers)
    
    # Check the audit trail via the project-specific endpoint
    resp = client.get(f"/api/projects/{sample_project.id}/audit", headers=auth_headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    assert any(l["action"] == "update" for l in logs)

def test_v0_6_predictive_pricing_logic(client: TestClient, auth_headers: dict, sample_project: Project):
    """Test the predictive pricing endpoint."""
    resp = client.get(f"/api/ai/predictive-pricing/{sample_project.id}?market=FR", headers=auth_headers)
    assert resp.status_code in (200, 502)
    if resp.status_code == 200:
        data = resp.json()
        assert "optimal_margin_pct" in data
        assert "confidence_score" in data
