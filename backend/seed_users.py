"""Seed des comptes utilisateurs RIHLA — équipe S'TOURS & HORIZON."""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import User, Role, RoleEnum
from sqlalchemy import select

USERS = [

    # ══════════════════════════════════════════════════════════════════════════
    # CEO
    # ══════════════════════════════════════════════════════════════════════════
    {
        "full_name": "Kamil Skalli",
        "email": "k.skalli@stours.ma",
        "password": "Skalli@CEO2026",
        "role": RoleEnum.SUPER_ADMIN,
        "poste": "CEO",
    },
    {
        "full_name": "Abdelwahed Chakir",
        "email": "a.chakir@stours.ma",
        "password": "Abdo@1937",
        "role": RoleEnum.SUPER_ADMIN,
        "poste": "Admin Plateforme",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # DIRECTEUR FINANCIER
    # ══════════════════════════════════════════════════════════════════════════
    {
        "full_name": "Mohamed Bahaj",
        "email": "m.bahaj@stours.ma",
        "password": "Bahaj@Finance2026",
        "role": RoleEnum.QUOTATION_OFFICER,
        "poste": "Directeur Financier",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # RESPONSABLE TRANSPORT — HORIZON
    # ══════════════════════════════════════════════════════════════════════════
    {
        "full_name": "Walid Maadi",
        "email": "w.maadi@ridehorizon.ma",
        "password": "Maadi@Transport2026",
        "role": RoleEnum.SALES_DIRECTOR,
        "poste": "Responsable Transport — RIDE HORIZON",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # TRAVEL DESIGNERS — DMC
    # ══════════════════════════════════════════════════════════════════════════
    {
        "full_name": "Mehdi Aboulkamal",
        "email": "m.aboulkamal@stours.ma",
        "password": "Aboulkamal@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Safaa Ait Nasser",
        "email": "s.aitnasser@stours.ma",
        "password": "AitNasser@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Hamza Tazi",
        "email": "h.tazi@stours.ma",
        "password": "Tazi@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Siham El Hanafy",
        "email": "s.elhanafy@stours.ma",
        "password": "Hanafy@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Imane Kanane",
        "email": "i.kanane@stours.ma",
        "password": "Kanane@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Nahla Cherkaoui",
        "email": "n.cherkaoui@stours.ma",
        "password": "Cherkaoui@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Majdouline Berchiche",
        "email": "m.berchiche@stours.ma",
        "password": "Berchiche@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },
    {
        "full_name": "Aziz El Hajji",
        "email": "a.elhajji@stours.ma",
        "password": "Elhajji@DMC2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer DMC",
    },

    # ══════════════════════════════════════════════════════════════════════════
    # TRAVEL DESIGNERS — INCENTIVES
    # ══════════════════════════════════════════════════════════════════════════
    {
        "full_name": "Ahmed Sakhi",
        "email": "a.sakhi@stours.ma",
        "password": "Sakhi@Incentive2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer Incentives",
    },
    {
        "full_name": "Adil El Boughdadi",
        "email": "a.elboughdadi@stours.ma",
        "password": "Boughdadi@Incentive2026",
        "role": RoleEnum.TRAVEL_DESIGNER,
        "poste": "Travel Designer Incentives",
    },
]


def seed():
    db = SessionLocal()
    created = []
    skipped = []

    for u in USERS:
        existing = db.execute(select(User).where(User.email == u["email"])).scalars().first()
        if existing:
            skipped.append(u["email"])
            continue

        role = db.execute(select(Role).where(Role.name == u["role"])).scalars().first()
        if not role:
            print(f"  [ERREUR] Rôle '{u['role']}' introuvable — lancez d'abord POST /api/admin/roles/initialize")
            continue

        db.add(User(
            full_name=u["full_name"],
            email=u["email"],
            password_hash=hash_password(u["password"]),
            role_id=role.id,
            is_active=True,
        ))
        created.append(u)

    db.commit()
    db.close()

    # ── Affichage récapitulatif ──────────────────────────────────────────────
    sections = [
        ("CEO", RoleEnum.SUPER_ADMIN),
        ("Directeur Financier", RoleEnum.QUOTATION_OFFICER),
        ("Responsable Transport", RoleEnum.SALES_DIRECTOR),
        ("Travel Designer DMC", RoleEnum.TRAVEL_DESIGNER),
        ("Travel Designer Incentives", RoleEnum.TRAVEL_DESIGNER),
    ]

    print("\n" + "═" * 68)
    print("  RIHLA — Équipe S'TOURS & HORIZON")
    print("═" * 68)

    all_users = created + [{"email": e, "poste": "déjà existant", "password": "—", "full_name": e} for e in skipped]

    groups: dict[str, list] = {}
    for u in created:
        groups.setdefault(u["poste"], []).append(u)

    for poste, users in groups.items():
        print(f"\n  ── {poste} ──")
        for u in users:
            print(f"  {u['full_name']:<25} {u['email']:<35} {u['password']}")

    if skipped:
        print(f"\n  [Ignorés — déjà en base] : {', '.join(skipped)}")
    print("\n" + "═" * 68)
    print(f"  {len(created)} compte(s) créé(s)  |  {len(skipped)} ignoré(s)")
    print("═" * 68 + "\n")


if __name__ == "__main__":
    seed()
