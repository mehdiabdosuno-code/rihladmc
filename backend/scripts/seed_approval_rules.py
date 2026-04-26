"""Seed default approval rules for STOURS VOYAGES.

Idempotent: skips rules whose `name` already exists for the company.

Usage:
    python -m scripts.seed_approval_rules <company_id>
"""
from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.database import SessionLocal


DEFAULT_RULES = [
    {
        "name": "Devis > 50 000 MAD — validation Direction Commerciale",
        "entity_type": "quotation",
        "conditions": {"all": [{"field": "total_selling", "op": "gt", "value": 50000}]},
        "mode": "sequential",
        "approvers": [{"role": "sales_director"}],
        "sla_hours": 24,
    },
    {
        "name": "Devis > 200 000 MAD — Direction + DG",
        "entity_type": "quotation",
        "conditions": {"all": [{"field": "total_selling", "op": "gt", "value": 200000}]},
        "mode": "sequential",
        "approvers": [{"role": "sales_director"}, {"role": "director"}],
        "sla_hours": 48,
    },
    {
        "name": "Facture > 100 000 MAD — validation Direction",
        "entity_type": "invoice",
        "conditions": {"all": [{"field": "total", "op": "gt", "value": 100000}]},
        "mode": "sequential",
        "approvers": [{"role": "director"}],
        "sla_hours": 48,
    },
    {
        "name": "Contrat fournisseur — toujours valider",
        "entity_type": "contract",
        "conditions": None,
        "mode": "sequential",
        "approvers": [{"role": "sales_director"}],
        "sla_hours": 72,
    },
]


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.seed_approval_rules <company_id>")
        sys.exit(1)
    company_id = sys.argv[1]
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        for rule in DEFAULT_RULES:
            existing = db.execute(
                text("SELECT id FROM approval_rules WHERE company_id=:c AND name=:n"),
                {"c": company_id, "n": rule["name"]},
            ).first()
            if existing:
                print(f"  · skip (exists) — {rule['name']}")
                continue
            import json as _json
            db.execute(
                text(
                    "INSERT INTO approval_rules "
                    "(id, company_id, name, entity_type, is_active, conditions, mode, "
                    "approvers, sla_hours, created_at, updated_at, active) "
                    "VALUES (:id, :c, :n, :et, 1, :cond, :mode, :ap, :sla, :now, :now, 1)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "c": company_id,
                    "n": rule["name"],
                    "et": rule["entity_type"],
                    "cond": _json.dumps(rule["conditions"]) if rule["conditions"] is not None else None,
                    "mode": rule["mode"],
                    "ap": _json.dumps(rule["approvers"]),
                    "sla": rule["sla_hours"],
                    "now": now,
                },
            )
            print(f"  ✓ created — {rule['name']}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
