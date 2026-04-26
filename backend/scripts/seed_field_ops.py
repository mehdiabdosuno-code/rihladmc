"""Seed script for Field Operations data."""

import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.core.database import SessionLocal
from app.modules.field_ops.models import FieldTask, TaskStatus, TaskType
from app.modules.projects.models import Project

def seed_field_ops():
    db = SessionLocal()
    try:
        # Get a sample project
        project = db.query(Project).first()
        if not project:
            print("❌ No projects found. Run project seeders first.")
            return

        # Create tasks for a mock staff (id 'staff-123')
        tasks = [
            FieldTask(
                project_id=project.id,
                staff_id="staff-123",
                title="Transfert Arrivée - Marrakech Menara",
                description="Accueillir les clients avec pancarte S'TOURS.",
                task_type=TaskType.TRANSFER,
                status=TaskStatus.ACTIVE,
                start_time="09:00",
                location="Aéroport Marrakech Menara",
                pax_count=project.pax_count or 2,
                vehicle_info="Mercedes Class V (44-A-1234)"
            ),
            FieldTask(
                project_id=project.id,
                staff_id="staff-123",
                title="Visite Guidée - Médina & Souks",
                description="Circuit historique incluant la Medersa Ben Youssef.",
                task_type=TaskType.TOUR,
                status=TaskStatus.PENDING,
                start_time="14:30",
                location="Médina de Marrakech",
                pax_count=project.pax_count or 2,
                vehicle_info="À pied"
            ),
            FieldTask(
                project_id=project.id,
                staff_id="staff-123",
                title="Transfert Dîner - Palais Gharnata",
                description="Transfert soirée de luxe.",
                task_type=TaskType.TRANSFER,
                status=TaskStatus.PENDING,
                start_time="20:00",
                location="Palais Gharnata, Fès",
                pax_count=project.pax_count or 2,
                vehicle_info="Minibus VIP"
            )
        ]

        for t in tasks:
            db.add(t)
        
        db.commit()
        print("✅ Field Ops tasks seeded successfully for staff-123.")

    except Exception as e:
        print(f"❌ Error seeding field ops: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_field_ops()
