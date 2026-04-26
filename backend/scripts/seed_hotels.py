import json
import os
import sys
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.modules.hotels.models import Hotel

def seed_hotels():
    db = SessionLocal()
    try:
        hotel_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../HOTELS/database.json'))
        if not os.path.exists(hotel_file):
            print(f"❌ Fichier non trouvé : {hotel_file}")
            return

        with open(hotel_file, 'r', encoding='utf-8') as f:
            hotels_data = json.load(f)

        print(f"🌱 Importation de {len(hotels_data)} hôtels...")
        
        for data in hotels_data:
            # Check if exists
            exists = db.query(Hotel).filter(Hotel.name == data['name']).first()
            if not exists:
                hotel = Hotel(
                    name=data['name'],
                    city=data['city'],
                    category=data['category'],
                    base_rate=data['base_rate'],
                    single_supplement=data['single_supplement'],
                    season=data['season'],
                    status=data['status'],
                    image_url=data.get('img')
                )
                db.add(hotel)
                print(f"✅ Ajouté : {data['name']}")
            else:
                print(f"ℹ️ Déjà présent : {data['name']}")

        db.commit()
        print("🚀 Seeding hôtelier terminé.")

    except Exception as e:
        print(f"❌ Erreur : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_hotels()
