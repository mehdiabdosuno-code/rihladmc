import sys
import os
from sqlalchemy.orm import Session

# Add backend to path to import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.modules.auth.models import User, Role, RoleEnum
from app.core.security import get_password_hash

def seed_stakeholders():
    db = SessionLocal()
    try:
        print("🌱 Création des rôles et utilisateurs de démonstration...")
        
        # Ensure Roles exist
        roles_data = [
            (RoleEnum.DIRECTOR, "Direction S'TOURS"),
            (RoleEnum.DRIVER, "Chauffeurs VIP"),
            (RoleEnum.GUIDE, "Guides Accompagnateurs"),
            (RoleEnum.CLIENT, "Agences B2B"),
        ]
        
        role_map = {}
        for role_name, desc in roles_data:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, description=desc)
                db.add(role)
                db.flush()
            role_map[role_name] = role.id

        # Users to create
        users_data = [
            ("directeur@stours.ma", "Directeur Général", "Directeur123!", RoleEnum.DIRECTOR),
            ("chauffeur@stours.ma", "Hassan Chauffeur", "Chauffeur123!", RoleEnum.DRIVER),
            ("guide@stours.ma", "Youssef Guide", "Guide123!", RoleEnum.GUIDE),
            ("agence@travel.com", "Travel Agency XYZ", "Agence123!", RoleEnum.CLIENT),
        ]

        for email, name, pwd, role_enum in users_data:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    email=email,
                    full_name=name,
                    password_hash=get_password_hash(pwd),
                    role_id=role_map[role_enum],
                    is_active=True
                )
                db.add(user)
                print(f"✅ Utilisateur créé : {email} ({role_enum})")
            else:
                print(f"ℹ️ Utilisateur déjà présent : {email}")

        db.commit()
        print("\n🚀 Terminé ! Vous pouvez maintenant tester les connexions.")
        
    except Exception as e:
        print(f"❌ Erreur lors du seeding : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_stakeholders()
