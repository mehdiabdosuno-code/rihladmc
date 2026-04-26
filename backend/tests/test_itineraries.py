"""Tests for Itineraries — create, add day, update day, reorder, delete."""

import pytest
from fastapi.testclient import TestClient
from app.modules.projects.models import Project


@pytest.fixture
def itinerary(client: TestClient, auth_headers: dict, sample_project: Project):
    resp = client.post("/api/itineraries/", json={
        "project_id": sample_project.id,
        "language": "fr",
        "days": [],
    }, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
def day(client: TestClient, auth_headers: dict, itinerary: dict):
    resp = client.post(f"/api/itineraries/{itinerary['id']}/days", json={
        "day_number": 1,
        "title": "Arrivée à Marrakech",
        "city": "Marrakech",
        "hotel": "Hôtel Sofitel",
        "hotel_category": "5★",
        "meal_plan": "BB",
        "activities": ["Visite Médina", "Souk"],
    }, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


class TestItineraryCreate:
    def test_create_requires_auth(self, client: TestClient, sample_project: Project):
        resp = client.post("/api/itineraries/", json={"project_id": sample_project.id})
        assert resp.status_code in (401, 403)

    def test_create_empty(self, client: TestClient, auth_headers: dict, sample_project: Project):
        resp = client.post("/api/itineraries/", json={
            "project_id": sample_project.id, "language": "fr", "days": []
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["project_id"] == sample_project.id
        assert data["days"] == []

    def test_create_with_days(self, client: TestClient, auth_headers: dict, sample_project: Project):
        resp = client.post("/api/itineraries/", json={
            "project_id": sample_project.id,
            "language": "fr",
            "days": [
                {"day_number": 1, "title": "Jour 1 — Marrakech", "city": "Marrakech"},
                {"day_number": 2, "title": "Jour 2 — Fès", "city": "Fès"},
            ],
        }, headers=auth_headers)
        assert resp.status_code == 201
        assert len(resp.json()["days"]) == 2

    def test_list_by_project(self, client: TestClient, auth_headers: dict, itinerary: dict, sample_project: Project):
        resp = client.get(f"/api/itineraries/project/{sample_project.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_get_by_id(self, client: TestClient, auth_headers: dict, itinerary: dict):
        resp = client.get(f"/api/itineraries/{itinerary['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == itinerary["id"]

    def test_get_not_found(self, client: TestClient, auth_headers: dict):
        resp = client.get("/api/itineraries/00000000-0000-0000-0000-000000000000", headers=auth_headers)
        assert resp.status_code == 404


class TestItineraryDays:
    def test_add_day(self, client: TestClient, auth_headers: dict, itinerary: dict, day: dict):
        assert day["title"] == "Arrivée à Marrakech"
        assert day["city"] == "Marrakech"
        assert day["ai_generated"] is False

    def test_day_activities_preserved(self, client: TestClient, auth_headers: dict, day: dict):
        assert "Visite Médina" in day["activities"]
        assert "Souk" in day["activities"]

    def test_update_day(self, client: TestClient, auth_headers: dict, itinerary: dict, day: dict):
        resp = client.put(
            f"/api/itineraries/{itinerary['id']}/days/{day['id']}",
            json={**day, "title": "Arrivée & Médina", "hotel": "Hôtel Mamounia"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Arrivée & Médina"
        assert resp.json()["hotel"] == "Hôtel Mamounia"

    def test_delete_day(self, client: TestClient, auth_headers: dict, itinerary: dict, day: dict):
        resp = client.delete(
            f"/api/itineraries/{itinerary['id']}/days/{day['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    def test_reorder_days(self, client: TestClient, auth_headers: dict, itinerary: dict):
        # Create two days
        d1 = client.post(f"/api/itineraries/{itinerary['id']}/days",
                         json={"day_number": 1, "title": "Jour A"}, headers=auth_headers).json()
        d2 = client.post(f"/api/itineraries/{itinerary['id']}/days",
                         json={"day_number": 2, "title": "Jour B"}, headers=auth_headers).json()

        resp = client.patch(f"/api/itineraries/{itinerary['id']}/reorder",
                            json=[{"id": d1["id"], "day_number": 2},
                                  {"id": d2["id"], "day_number": 1}],
                            headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Reorder successful"
