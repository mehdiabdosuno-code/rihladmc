"""Tests for Proposal sharing — create share link, public view, comment, accept."""

import pytest
from fastapi.testclient import TestClient
from app.modules.projects.models import Project


@pytest.fixture
def share(client: TestClient, auth_headers: dict, sample_project: Project):
    resp = client.post(f"/api/proposals/{sample_project.id}/share", json={
        "client_name": "Jean Dupont",
        "client_email": "jean@dupont.fr",
    }, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


class TestShareCreation:
    def test_create_requires_auth(self, client: TestClient, sample_project: Project):
        resp = client.post(f"/api/proposals/{sample_project.id}/share", json={})
        assert resp.status_code in (401, 403)

    def test_create_success(self, client: TestClient, auth_headers: dict, sample_project: Project):
        resp = client.post(f"/api/proposals/{sample_project.id}/share",
                           json={"client_name": "Alice"}, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert len(data["token"]) == 36  # UUID
        assert data["is_accepted"] is False
        assert data["views"] == 0

    def test_create_idempotent(self, client: TestClient, auth_headers: dict, sample_project: Project):
        """Creating a second share for the same project reuses the existing one."""
        r1 = client.post(f"/api/proposals/{sample_project.id}/share", json={}, headers=auth_headers)
        r2 = client.post(f"/api/proposals/{sample_project.id}/share", json={}, headers=auth_headers)
        assert r1.json()["token"] == r2.json()["token"]

    def test_create_unknown_project(self, client: TestClient, auth_headers: dict):
        resp = client.post("/api/proposals/00000000-0000-0000-0000-000000000000/share",
                           json={}, headers=auth_headers)
        assert resp.status_code == 404

    def test_list_shares(self, client: TestClient, auth_headers: dict, share: dict, sample_project: Project):
        resp = client.get(f"/api/proposals/{sample_project.id}/shares", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


class TestPublicView:
    def test_view_increments_views(self, client: TestClient, share: dict):
        token = share["token"]
        r1 = client.get(f"/api/proposals/view/{token}")
        assert r1.status_code == 200
        assert r1.json()["share"]["views"] == 1

        r2 = client.get(f"/api/proposals/view/{token}")
        assert r2.json()["share"]["views"] == 2

    def test_view_includes_project_data(self, client: TestClient, share: dict, sample_project: Project):
        data = client.get(f"/api/proposals/view/{share['token']}").json()
        assert data["project"]["name"] == sample_project.name
        assert data["project"]["destination"] == sample_project.destination

    def test_view_invalid_token(self, client: TestClient):
        resp = client.get("/api/proposals/view/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    def test_view_no_auth_required(self, client: TestClient, share: dict):
        """Public endpoint — no Authorization header needed."""
        resp = client.get(f"/api/proposals/view/{share['token']}")
        assert resp.status_code == 200


class TestComments:
    def test_add_comment(self, client: TestClient, share: dict):
        resp = client.post(f"/api/proposals/view/{share['token']}/comments", json={
            "author_name": "Jean Dupont",
            "content": "Peut-on changer l'hôtel du jour 3 ?",
            "day_number": 3,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["author_name"] == "Jean Dupont"
        assert data["day_number"] == 3
        assert data["is_resolved"] is False

    def test_global_comment(self, client: TestClient, share: dict):
        resp = client.post(f"/api/proposals/view/{share['token']}/comments", json={
            "author_name": "Alice",
            "content": "Excellent programme !",
        })
        assert resp.status_code == 201
        assert resp.json()["day_number"] is None

    def test_comments_appear_in_view(self, client: TestClient, share: dict):
        client.post(f"/api/proposals/view/{share['token']}/comments", json={
            "author_name": "Bob", "content": "Super !"
        })
        view = client.get(f"/api/proposals/view/{share['token']}").json()
        assert len(view["comments"]) == 1
        assert view["comments"][0]["author_name"] == "Bob"

    def test_comment_invalid_token(self, client: TestClient):
        resp = client.post("/api/proposals/view/bad-token/comments", json={
            "author_name": "X", "content": "Y"
        })
        assert resp.status_code == 404


class TestAccept:
    def test_accept_proposal(self, client: TestClient, share: dict):
        resp = client.patch(f"/api/proposals/view/{share['token']}/accept")
        assert resp.status_code == 200
        assert "acceptée" in resp.json()["message"]

    def test_accept_reflects_in_view(self, client: TestClient, share: dict):
        client.patch(f"/api/proposals/view/{share['token']}/accept")
        view = client.get(f"/api/proposals/view/{share['token']}").json()
        assert view["share"]["is_accepted"] is True
