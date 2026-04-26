"""
Seed default companies and back-fill company_id on existing rows.

Creates STOURS VOYAGES and HORIZON Transport, then back-fills `company_id`
on every multi-tenant table to the STOURS VOYAGES company. Finally, every
existing user is enrolled in STOURS VOYAGES with their current role.

Run AFTER `alembic upgrade head` (revision 0006_companies_multitenant).

Usage:
    python -m scripts.seed_companies
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal


STOURS = {
    "code": "STOURS",
    "name": "STOURS VOYAGES",
    "legal_name": "STOURS VOYAGES SARL",
    "currency": "MAD",
}
HORIZON = {
    "code": "HORIZON",
    "name": "HORIZON Transport",
    "legal_name": "HORIZON Transport SARL",
    "currency": "MAD",
}

TENANT_TABLES = [
    "projects", "quotations", "itineraries", "menus", "transports",
    "guides", "hotels", "invoices", "proposals", "field_ops", "expenses",
    "notifications", "audit_events",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _company_exists(db: Session, code: str) -> str | None:
    row = db.execute(
        text("SELECT id FROM companies WHERE code = :c"),
        {"c": code},
    ).first()
    return row[0] if row else None


def _create_company(db: Session, payload: dict) -> str:
    cid = str(uuid.uuid4())
    db.execute(
        text(
            "INSERT INTO companies (id, code, name, legal_name, currency, "
            "fiscal_year_start, is_active, created_at, updated_at, active) "
            "VALUES (:id, :code, :name, :legal_name, :currency, 1, 1, :now, :now, 1)"
        ),
        {**payload, "id": cid, "now": _now()},
    )
    print(f"  ✓ Created company {payload['code']} → {cid}")
    return cid


def _table_exists(db: Session, name: str) -> bool:
    try:
        db.execute(text(f"SELECT 1 FROM {name} LIMIT 1"))
        return True
    except Exception:
        db.rollback()
        return False


def main() -> None:
    db = SessionLocal()
    try:
        print("Seeding companies…")
        stours_id = _company_exists(db, "STOURS") or _create_company(db, STOURS)
        horizon_id = _company_exists(db, "HORIZON") or _create_company(db, HORIZON)

        print("\nBack-filling company_id on existing rows → STOURS VOYAGES")
        for tbl in TENANT_TABLES:
            if not _table_exists(db, tbl):
                continue
            res = db.execute(
                text(
                    f"UPDATE {tbl} SET company_id = :cid WHERE company_id IS NULL"
                ),
                {"cid": stours_id},
            )
            print(f"  • {tbl}: {res.rowcount or 0} rows updated")

        print("\nEnrolling existing users in STOURS VOYAGES…")
        users = db.execute(
            text(
                "SELECT u.id, COALESCE(r.name, 'sales_agent') AS role "
                "FROM users u LEFT JOIN roles r ON r.id = u.role_id"
            )
        ).all()
        for user_id, role in users:
            existing = db.execute(
                text(
                    "SELECT id FROM user_companies "
                    "WHERE user_id = :u AND company_id = :c"
                ),
                {"u": user_id, "c": stours_id},
            ).first()
            if existing:
                continue
            db.execute(
                text(
                    "INSERT INTO user_companies (id, user_id, company_id, role, "
                    "is_default, created_at, updated_at, active) "
                    "VALUES (:id, :u, :c, :r, 1, :now, :now, 1)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "u": user_id,
                    "c": stours_id,
                    "r": role,
                    "now": _now(),
                },
            )
        print(f"  ✓ Enrolled {len(users)} users")

        db.commit()
        print(f"\nDone. STOURS={stours_id}  HORIZON={horizon_id}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
