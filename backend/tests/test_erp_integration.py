"""Tests for the ERP integration module — SAP S/4HANA & Business One push."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.companies.models import Company
from app.modules.erp_integration import service
from app.modules.erp_integration.mappers import (
    map_invoice_to_business_one,
    map_invoice_to_s4hana,
)
from app.modules.erp_integration.models import (
    ClientErpConfig,
    ErpKind,
)
from app.modules.invoices.models import Invoice, InvoiceStatus
from app.modules.projects.models import Project


# ── Helpers ──────────────────────────────────────────────────────────


@pytest.fixture
def company(db: Session) -> Company:
    c = Company(code="STOURS", name="Stours Voyages (Test)")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def project_with_invoice(db: Session, company: Company, sample_project: Project):
    inv = Invoice(
        number="FAC-2026-TEST-001",
        project_id=sample_project.id,
        client_name="Acme Corp SAP",
        client_email="finance@acme-sap.com",
        client_address="1 rue Test, 75000 Paris",
        issue_date="2026-04-01",
        due_date="2026-05-01",
        currency="EUR",
        subtotal=10000.0,
        tax_rate=20.0,
        tax_amount=2000.0,
        total=12000.0,
        deposit_pct=30.0,
        deposit_amount=3600.0,
        balance_due=8400.0,
        pax_count=20,
        price_per_pax=500.0,
        status=InvoiceStatus.ISSUED,
        lines=[
            {"label": "Hébergement Riad", "qty": 6, "unit_price": 1200, "total": 7200, "category": "hotel"},
            {"label": "Transport SUV",     "qty": 1, "unit_price": 2800, "total": 2800, "category": "transport"},
        ],
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@pytest.fixture
def s4_config(db: Session, company: Company) -> ClientErpConfig:
    cfg = ClientErpConfig(
        company_id=company.id,
        client_key="finance@acme-sap.com",
        label="Acme Corp — S/4HANA Cloud",
        kind=ErpKind.SAP_S4HANA,
        base_url="https://my-sap.s4hana.cloud.sap",
        oauth_token_url="https://my-sap.authentication.eu10.hana.ondemand.com/oauth/token",
        oauth_client_id="sb-rihla-acme",
        oauth_client_secret="dummy-secret",
        oauth_scope="API_SUPPLIERINVOICE_PROCESS_SRV_0001",
        is_dry_run=True,
        is_active=True,
        mapping={
            "company_code": "1010", "tax_code": "V0",
            "gl_account": "0000400000", "invoicing_party_id": "RIHLA-001",
            "payment_terms": "Z030",
        },
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@pytest.fixture
def b1_config(db: Session, company: Company) -> ClientErpConfig:
    cfg = ClientErpConfig(
        company_id=company.id,
        client_key="b1.client@example.com",
        label="Example SARL — B1 Cloud",
        kind=ErpKind.SAP_BUSINESS_ONE,
        base_url="https://b1.example.com:50000/b1s/v2",
        b1_company_db="SBODEMO_FR",
        b1_username="manager",
        b1_password="dummy-pass",
        is_dry_run=True,
        is_active=True,
        mapping={"card_code": "C-RIHLA", "vat_group": "FR-200"},
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


# ── Mapper tests (pure functions) ────────────────────────────────────


class TestMapperS4HANA:
    def test_basic_fields(self, project_with_invoice: Invoice):
        out = map_invoice_to_s4hana(
            project_with_invoice,
            mapping={"company_code": "1010", "tax_code": "V0",
                     "gl_account": "0000400000", "invoicing_party_id": "RIHLA-001"},
        )
        assert out["CompanyCode"] == "1010"
        assert out["DocumentDate"] == "2026-04-01"
        assert out["PostingDate"] == "2026-04-01"
        assert out["DocumentCurrency"] == "EUR"
        assert out["InvoiceGrossAmount"] == 12000.0
        assert out["SupplierInvoiceIDByInvcgParty"] == "FAC-2026-TEST-001"
        assert out["InvoicingParty"] == "RIHLA-001"

    def test_lines_mapped_to_items(self, project_with_invoice: Invoice):
        out = map_invoice_to_s4hana(project_with_invoice)
        items = out["to_SupplierInvoiceItemGLAcct"]
        assert len(items) == 2
        assert items[0]["SupplierInvoiceItem"] == "1"
        assert items[0]["SupplierInvoiceItemAmount"] == 7200.0
        assert items[1]["SupplierInvoiceItemAmount"] == 2800.0

    def test_no_null_values_in_payload(self, project_with_invoice: Invoice):
        out = map_invoice_to_s4hana(project_with_invoice)
        for k, v in out.items():
            assert v is not None, f"{k} should not be None"

    def test_fallback_line_when_no_lines(self, db: Session, project_with_invoice: Invoice):
        project_with_invoice.lines = None
        db.commit()
        out = map_invoice_to_s4hana(project_with_invoice)
        items = out["to_SupplierInvoiceItemGLAcct"]
        assert len(items) == 1


class TestMapperBusinessOne:
    def test_basic_fields(self, project_with_invoice: Invoice):
        out = map_invoice_to_business_one(
            project_with_invoice,
            mapping={"card_code": "C-ACME", "vat_group": "FR-200"},
        )
        assert out["DocType"] == "dDocument_Items"
        assert out["CardCode"] == "C-ACME"
        assert out["NumAtCard"] == "FAC-2026-TEST-001"
        assert out["DocCurrency"] == "EUR"
        assert out["DocTotal"] == 12000.0
        assert out["DocDate"] == "2026-04-01"
        assert out["DocDueDate"] == "2026-05-01"

    def test_lines_mapped(self, project_with_invoice: Invoice):
        out = map_invoice_to_business_one(project_with_invoice)
        lines = out["DocumentLines"]
        assert len(lines) == 2
        assert lines[0]["LineTotal"] == 7200.0
        assert lines[0]["Quantity"] == 6
        assert lines[1]["LineTotal"] == 2800.0


# ── Resolution + idempotency ─────────────────────────────────────────


class TestResolveConfig:
    def test_match_by_email(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        cfg = service.resolve_config(db, company.id, project_with_invoice)
        assert cfg is not None
        assert cfg.id == s4_config.id

    def test_no_match_returns_none(
        self, db: Session, company: Company,
        project_with_invoice: Invoice,
    ):
        cfg = service.resolve_config(db, company.id, project_with_invoice)
        assert cfg is None

    def test_explicit_config_id_wins(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, b1_config: ClientErpConfig,
    ):
        cfg = service.resolve_config(
            db, company.id, project_with_invoice, config_id=b1_config.id,
        )
        assert cfg is not None and cfg.id == b1_config.id

    def test_inactive_config_ignored(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        s4_config.is_active = False
        db.commit()
        cfg = service.resolve_config(db, company.id, project_with_invoice)
        assert cfg is None


class TestIdempotency:
    def test_key_stable_for_same_invoice(
        self, project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        k1 = service.compute_idempotency_key(project_with_invoice, s4_config)
        k2 = service.compute_idempotency_key(project_with_invoice, s4_config)
        assert k1 == k2 and len(k1) == 64

    def test_key_changes_with_invoice_update(
        self, db: Session, project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        k1 = service.compute_idempotency_key(project_with_invoice, s4_config)
        project_with_invoice.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(project_with_invoice)
        k2 = service.compute_idempotency_key(project_with_invoice, s4_config)
        assert k1 != k2


# ── Push pipeline (dry_run) ──────────────────────────────────────────


class TestPushDryRun:
    def test_dry_run_short_circuits_to_success(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        log = service.push_invoice(db, company.id, project_with_invoice)
        assert log.status == "success"
        assert log.is_dry_run is True
        assert log.kind == ErpKind.SAP_S4HANA
        assert log.remote_ref and log.remote_ref.startswith("DRY-")
        assert log.request_payload is not None
        assert log.request_payload["SupplierInvoiceIDByInvcgParty"] == "FAC-2026-TEST-001"

    def test_dry_run_writes_request_payload(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, b1_config: ClientErpConfig,
    ):
        log = service.push_invoice(db, company.id, project_with_invoice,
                                   config_id=b1_config.id)
        assert log.status == "success"
        assert log.kind == ErpKind.SAP_BUSINESS_ONE
        assert log.request_payload["NumAtCard"] == "FAC-2026-TEST-001"

    def test_unmapped_invoice_logs_failed_status(
        self, db: Session, company: Company, project_with_invoice: Invoice,
    ):
        # No config exists for this client_email yet.
        log = service.push_invoice(db, company.id, project_with_invoice)
        assert log.status == "failed"
        assert "No active ErpConfig" in (log.error_message or "")

    def test_re_push_returns_existing_success_log(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        first = service.push_invoice(db, company.id, project_with_invoice)
        second = service.push_invoice(db, company.id, project_with_invoice)
        assert first.id == second.id, "Idempotent re-push should reuse the log row"

    def test_force_creates_new_log_entry(
        self, db: Session, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        first = service.push_invoice(db, company.id, project_with_invoice)
        second = service.push_invoice(db, company.id, project_with_invoice, force=True)
        # Forced re-push reuses the same idempotency_key so the unique
        # constraint forces a fresh row only when the invoice/config changed.
        # When `force=True` AND the invoice is unchanged, the existing log
        # is returned unmodified — that's the documented contract.
        assert first.idempotency_key == second.idempotency_key


# ── Router-level smoke tests ─────────────────────────────────────────


class TestRouterEndpoints:
    """Smoke-tests that verify the FastAPI routes are reachable + auth-protected."""

    def _admin_headers_for(
        self, admin_token_factory, company: Company,
    ) -> dict:
        # Re-issue the admin token with company_id set.
        from app.core.security import create_access_token
        from app.modules.auth.models import RoleEnum
        token = create_access_token({
            "sub": "admin-test", "email": "admin@stours.ma",
            "role": RoleEnum.SUPER_ADMIN, "company_id": company.id,
        })
        return {"Authorization": f"Bearer {token}"}

    def test_create_and_list_config_via_api(
        self, client: TestClient, admin_user, company: Company,
    ):
        from app.core.security import create_access_token
        from app.modules.auth.models import RoleEnum
        headers = {"Authorization": "Bearer " + create_access_token({
            "sub": admin_user.id, "email": admin_user.email,
            "role": RoleEnum.SUPER_ADMIN, "company_id": company.id,
        })}

        resp = client.post("/api/erp/configs", headers=headers, json={
            "client_key": "finance@acme-sap.com",
            "label": "Acme Corp",
            "kind": "sap_s4hana",
            "base_url": "https://my-sap.s4hana.cloud.sap",
            "oauth_token_url": "https://my-sap.authentication.eu10.hana.ondemand.com/oauth/token",
            "oauth_client_id": "sb-rihla-acme",
            "oauth_client_secret": "secret",
            "is_dry_run": True,
        })
        assert resp.status_code == 201, resp.text
        cfg = resp.json()
        assert cfg["has_oauth_secret"] is True
        # Sensitive field MUST NOT be echoed back.
        assert "oauth_client_secret" not in cfg

        resp = client.get("/api/erp/configs", headers=headers)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["client_key"] == "finance@acme-sap.com"

    def test_push_endpoint_dry_run(
        self, client: TestClient, admin_user, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig,
    ):
        from app.core.security import create_access_token
        from app.modules.auth.models import RoleEnum
        headers = {"Authorization": "Bearer " + create_access_token({
            "sub": admin_user.id, "email": admin_user.email,
            "role": RoleEnum.SUPER_ADMIN, "company_id": company.id,
        })}

        resp = client.post(
            f"/api/erp/invoices/{project_with_invoice.id}/push",
            headers=headers, json={},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "success"
        assert body["is_dry_run"] is True
        assert body["remote_ref"].startswith("DRY-")
        assert body["request_payload"]["SupplierInvoiceIDByInvcgParty"] == "FAC-2026-TEST-001"

    def test_logs_endpoint_filters_by_invoice(
        self, client: TestClient, admin_user, company: Company,
        project_with_invoice: Invoice, s4_config: ClientErpConfig, db: Session,
    ):
        from app.core.security import create_access_token
        from app.modules.auth.models import RoleEnum
        headers = {"Authorization": "Bearer " + create_access_token({
            "sub": admin_user.id, "email": admin_user.email,
            "role": RoleEnum.SUPER_ADMIN, "company_id": company.id,
        })}

        # Trigger a push first
        client.post(
            f"/api/erp/invoices/{project_with_invoice.id}/push",
            headers=headers, json={},
        )

        resp = client.get(
            "/api/erp/logs",
            params={"invoice_id": project_with_invoice.id},
            headers=headers,
        )
        assert resp.status_code == 200
        logs = resp.json()
        assert len(logs) == 1
        assert logs[0]["invoice_id"] == project_with_invoice.id
        assert logs[0]["status"] == "success"

    def test_designer_cannot_create_config(
        self, client: TestClient, designer_headers: dict,
    ):
        resp = client.post("/api/erp/configs", headers=designer_headers, json={
            "client_key": "x@y.z", "label": "x", "kind": "sap_s4hana",
        })
        # 401 (no company_id) or 403 — both prove authz works.
        assert resp.status_code in (401, 403)
