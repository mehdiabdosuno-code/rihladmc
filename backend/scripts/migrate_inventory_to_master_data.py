"""
Migrate legacy inventory tables (hotels, transports, guides) into the unified
Partner + Article master data.

Run AFTER `alembic upgrade head` (revisions 0006+0007) and after seeding the
companies via `seed_companies.py`.

For each legacy hotel:
  - Creates a Partner (type=supplier) named after the hotel
  - Creates an Article (category=hotel_night) linked to that supplier

For each legacy guide:
  - Creates a Partner (type=guide)
  - Creates an Article (category=guide_day) linked to that guide

For each legacy transport:
  - Creates a Partner (type=supplier)  if not already present
  - Creates an Article (category=transport) linked to that supplier

Usage:
    python -m scripts.migrate_inventory_to_master_data <stours_company_id>
"""
from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _table_exists(db: Session, name: str) -> bool:
    try:
        db.execute(text(f"SELECT 1 FROM {name} LIMIT 1"))
        return True
    except Exception:
        db.rollback()
        return False


def _insert_partner(db, company_id, code, name, type_, legacy_table, legacy_id):
    pid = str(uuid.uuid4())
    db.execute(
        text(
            "INSERT INTO partners (id, company_id, code, name, type, currency, "
            "is_active, legacy_table, legacy_id, created_at, updated_at, active) "
            "VALUES (:id, :cid, :code, :name, :type, 'MAD', 1, :lt, :lid, :now, :now, 1)"
        ),
        {
            "id": pid,
            "cid": company_id,
            "code": code,
            "name": name,
            "type": type_,
            "lt": legacy_table,
            "lid": legacy_id,
            "now": _now(),
        },
    )
    return pid


def _insert_article(
    db, company_id, code, name, category, unit, purchase, sell, currency,
    supplier_id, legacy_table, legacy_id,
):
    aid = str(uuid.uuid4())
    db.execute(
        text(
            "INSERT INTO articles (id, company_id, code, name, category, unit, "
            "purchase_price, sell_price, currency, default_supplier_id, "
            "is_active, legacy_table, legacy_id, created_at, updated_at, active) "
            "VALUES (:id, :cid, :code, :name, :cat, :unit, :pp, :sp, :ccy, "
            ":sup, 1, :lt, :lid, :now, :now, 1)"
        ),
        {
            "id": aid, "cid": company_id, "code": code, "name": name,
            "cat": category, "unit": unit, "pp": purchase, "sp": sell,
            "ccy": currency or "MAD", "sup": supplier_id,
            "lt": legacy_table, "lid": legacy_id, "now": _now(),
        },
    )
    return aid


def _migrate_hotels(db: Session, company_id: str) -> int:
    if not _table_exists(db, "hotels"):
        return 0
    rows = db.execute(text("SELECT id, name, base_rate, currency FROM hotels")).all()
    n = 0
    for hotel_id, name, base_rate, currency in rows:
        # Skip if already migrated
        existing = db.execute(
            text("SELECT id FROM partners WHERE legacy_table='hotels' AND legacy_id=:id"),
            {"id": hotel_id},
        ).first()
        if existing:
            continue
        code = f"H-{name[:8].upper().replace(' ', '')}-{hotel_id[:4]}"
        pid = _insert_partner(db, company_id, code, name, "supplier", "hotels", hotel_id)
        _insert_article(
            db, company_id, code + "-NIGHT", f"{name} (nuit)", "hotel_night",
            "nuitée", base_rate, base_rate, currency, pid, "hotels", hotel_id,
        )
        n += 1
    return n


def _migrate_guides(db: Session, company_id: str) -> int:
    if not _table_exists(db, "guides"):
        return 0
    # Guide schema may vary; pick the most common columns defensively.
    try:
        rows = db.execute(
            text("SELECT id, full_name, daily_rate FROM guides")
        ).all()
    except Exception:
        db.rollback()
        try:
            rows = db.execute(text("SELECT id, name, daily_rate FROM guides")).all()
        except Exception:
            db.rollback()
            return 0
    n = 0
    for gid, name, daily in rows:
        existing = db.execute(
            text("SELECT id FROM partners WHERE legacy_table='guides' AND legacy_id=:id"),
            {"id": gid},
        ).first()
        if existing:
            continue
        code = f"G-{(name or '')[:8].upper().replace(' ', '')}-{gid[:4]}"
        pid = _insert_partner(db, company_id, code, name or "Guide", "guide", "guides", gid)
        _insert_article(
            db, company_id, code + "-DAY", f"{name} (jour)", "guide_day", "jour",
            daily, daily, "MAD", pid, "guides", gid,
        )
        n += 1
    return n


def _migrate_transports(db: Session, company_id: str) -> int:
    if not _table_exists(db, "transports"):
        return 0
    try:
        rows = db.execute(
            text("SELECT id, supplier, vehicle_type, daily_rate FROM transports")
        ).all()
    except Exception:
        db.rollback()
        return 0
    n = 0
    suppliers_by_name: dict[str, str] = {}
    for tid, supplier_name, vehicle_type, daily in rows:
        existing = db.execute(
            text("SELECT id FROM articles WHERE legacy_table='transports' AND legacy_id=:id"),
            {"id": tid},
        ).first()
        if existing:
            continue
        sup_name = supplier_name or "Transport"
        if sup_name in suppliers_by_name:
            sup_id = suppliers_by_name[sup_name]
        else:
            existing_sup = db.execute(
                text("SELECT id FROM partners WHERE company_id=:cid AND name=:name AND type='supplier'"),
                {"cid": company_id, "name": sup_name},
            ).first()
            if existing_sup:
                sup_id = existing_sup[0]
            else:
                code = f"T-{sup_name[:8].upper().replace(' ', '')}"
                sup_id = _insert_partner(
                    db, company_id, code, sup_name, "supplier",
                    "transports_supplier", tid,
                )
            suppliers_by_name[sup_name] = sup_id
        code = f"T-{(vehicle_type or 'VEH')[:6].upper()}-{tid[:4]}"
        _insert_article(
            db, company_id, code, f"{vehicle_type} ({sup_name})",
            "transport", "jour", daily, daily, "MAD", sup_id,
            "transports", tid,
        )
        n += 1
    return n


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.migrate_inventory_to_master_data <company_id>")
        sys.exit(1)
    company_id = sys.argv[1]

    db = SessionLocal()
    try:
        h = _migrate_hotels(db, company_id)
        print(f"Hotels migrated: {h}")
        g = _migrate_guides(db, company_id)
        print(f"Guides migrated: {g}")
        t = _migrate_transports(db, company_id)
        print(f"Transports migrated: {t}")
        db.commit()
        print("Done.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
