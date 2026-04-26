"""seed_data.py — Seed STOURS Studio database with initial data."""
import sys, os, uuid, json
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://rihla:rihla_secret_change_me@localhost:5432/rihla_db")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def _id(): return str(uuid.uuid4())
def _now(): return datetime.now(timezone.utc)

def seed(db):
    # Roles
    roles = ["super_admin","sales_director","travel_designer","quotation_officer","data_operator","sales_agent"]
    role_ids = {}
    for name in roles:
        rid = _id()
        role_ids[name] = rid
        db.execute(text("INSERT INTO roles (id,name,created_at,updated_at,active) VALUES (:id,:name,:now,:now,true) ON CONFLICT (name) DO NOTHING"),
                   {"id":rid,"name":name,"now":_now()})
    db.commit()
    print(f"  ✓ {len(roles)} roles")

    # Admin user
    try:
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        db.execute(text("INSERT INTO users (id,email,full_name,password_hash,is_active,role_id,created_at,updated_at,active) VALUES (:id,:email,:name,:hash,true,:rid,:now,:now,true) ON CONFLICT (email) DO NOTHING"),
                   {"id":_id(),"email":"a.chakir@stours.ma","name":"CHAKIR Abdelwahed","hash":pwd.hash("Abdo@1937"),"rid":role_ids["super_admin"],"now":_now()})
        db.commit()
        print("  ✓ Admin: a.chakir@stours.ma / Abdo@1937")
    except Exception as e:
        print(f"  ⚠ User seed skipped: {e}")

    # Demo project
    pid = _id()
    db.execute(text("""INSERT INTO projects (id,name,reference,client_name,status,project_type,destination,duration_days,duration_nights,pax_count,travel_dates,language,currency,created_at,updated_at,active)
        VALUES (:id,:name,:ref,:client,:status,:ptype,:dest,:days,:nights,:pax,:dates,:lang,:cur,:now,:now,true) ON CONFLICT DO NOTHING"""),
        {"id":pid,"name":"Kingdom of Experiences — Tech Corp","ref":"STOURS-2026-001","client":"Tech Corp International",
         "status":"in_progress","ptype":"incentive","dest":"Maroc","days":7,"nights":6,"pax":100,
         "dates":"Novembre 2026","lang":"fr","cur":"EUR","now":_now()})
    db.commit()
    print(f"  ✓ Demo project")

    # Report datasources
    sources = [
        {"name":"Ventes Maroc 2024","fields":[{"name":"Ville","type":"str","label":"Ville"},{"name":"Mois","type":"date","label":"Mois"},{"name":"Commercial","type":"str","label":"Commercial"},{"name":"Catégorie","type":"str","label":"Catégorie"},{"name":"CA","type":"num","label":"CA (EUR)"},{"name":"NbClients","type":"num","label":"Nb Clients"},{"name":"Marge","type":"num","label":"Marge %"}],
         "records":[
            {"Ville":"Marrakech","Mois":"Jan","Commercial":"Karim B.","Catégorie":"Circuits","CA":142000,"NbClients":34,"Marge":28},
            {"Ville":"Casablanca","Mois":"Jan","Commercial":"Sara M.","Catégorie":"Incentive","CA":210000,"NbClients":18,"Marge":32},
            {"Ville":"Fès","Mois":"Fév","Commercial":"Youssef A.","Catégorie":"Circuits","CA":98000,"NbClients":22,"Marge":24},
            {"Ville":"Agadir","Mois":"Fév","Commercial":"Karim B.","Catégorie":"Hôtels","CA":175000,"NbClients":41,"Marge":19},
            {"Ville":"Marrakech","Mois":"Mar","Commercial":"Sara M.","Catégorie":"Incentive","CA":320000,"NbClients":55,"Marge":35},
            {"Ville":"Tanger","Mois":"Mar","Commercial":"Youssef A.","Catégorie":"Circuits","CA":89000,"NbClients":17,"Marge":22},
            {"Ville":"Essaouira","Mois":"Avr","Commercial":"Karim B.","Catégorie":"Hôtels","CA":112000,"NbClients":29,"Marge":21},
            {"Ville":"Rabat","Mois":"Avr","Commercial":"Sara M.","Catégorie":"Circuits","CA":156000,"NbClients":38,"Marge":27}]},
        {"name":"Hôtels & Performance","fields":[{"name":"Hôtel","type":"str","label":"Hôtel"},{"name":"Ville","type":"str","label":"Ville"},{"name":"Nuitées","type":"num","label":"Nuitées"},{"name":"RevPAR","type":"num","label":"RevPAR"},{"name":"TauxOcc","type":"num","label":"Taux Occ %"}],
         "records":[
            {"Hôtel":"La Mamounia","Ville":"Marrakech","Nuitées":3200,"RevPAR":2800,"TauxOcc":87},
            {"Hôtel":"Hyatt Regency","Ville":"Casablanca","Nuitées":2800,"RevPAR":1900,"TauxOcc":82},
            {"Hôtel":"Palais Faraj","Ville":"Fès","Nuitées":1400,"RevPAR":1600,"TauxOcc":74},
            {"Hôtel":"Sofitel","Ville":"Agadir","Nuitées":4100,"RevPAR":1200,"TauxOcc":91},
            {"Hôtel":"Hilton","Ville":"Tanger","Nuitées":1800,"RevPAR":1400,"TauxOcc":78}]},
        {"name":"Base Clients","fields":[{"name":"Nom","type":"str","label":"Client"},{"name":"Pays","type":"str","label":"Pays"},{"name":"Segment","type":"str","label":"Segment"},{"name":"CA","type":"num","label":"CA Total"},{"name":"Voyages","type":"num","label":"Voyages"},{"name":"NPS","type":"num","label":"NPS"}],
         "records":[
            {"Nom":"ESO Travel","Pays":"Rép. Tchèque","Segment":"B2B","CA":480000,"Voyages":12,"NPS":92},
            {"Nom":"Luxe Voyages","Pays":"France","Segment":"B2B","CA":320000,"Voyages":8,"NPS":88},
            {"Nom":"Corporate Events","Pays":"Belgique","Segment":"Incentive","CA":290000,"Voyages":5,"NPS":95},
            {"Nom":"Atlas Explorers","Pays":"Allemagne","Segment":"Groupes","CA":180000,"Voyages":15,"NPS":79},
            {"Nom":"Premium Tours","Pays":"Espagne","Segment":"B2B","CA":240000,"Voyages":9,"NPS":85}]},
    ]

    first_sid = None
    for i, src in enumerate(sources):
        sid = _id()
        if i == 0: first_sid = sid
        db.execute(text("INSERT INTO report_data_sources (id,name,source_type,fields,is_active,created_at,updated_at,active) VALUES (:id,:name,'manual',:fields,true,:now,:now,true)"),
                   {"id":sid,"name":src["name"],"fields":json.dumps(src["fields"]),"now":_now()})
        for row in src["records"]:
            db.execute(text("INSERT INTO report_data_records (id,data_source_id,row_data,created_at,updated_at,active) VALUES (:id,:sid,:row,:now,:now,true)"),
                       {"id":_id(),"sid":sid,"row":json.dumps(row),"now":_now()})

    # Template report
    if first_sid:
        db.execute(text("INSERT INTO reports (id,name,subtitle,data_source_id,widgets,filters,settings,is_template,created_at,updated_at,active) VALUES (:id,:name,:sub,:src,:widgets,:filters,:settings,true,:now,:now,true)"),
            {"id":_id(),"name":"Rapport Ventes Maroc 2024","sub":"Rapport template STOURS Studio","src":first_sid,
             "widgets":json.dumps([{"type":"kpi","order":0},{"type":"chart","order":1},{"type":"table","order":2}]),
             "filters":json.dumps([]),"settings":json.dumps({"color":"#A8371D","group_by":"Ville","chart_metric":"CA","show_totals":True}),"now":_now()})
    db.commit()
    # Guides
    guides = [
        {"name": "Ahmed El Mansouri", "city": "Marrakech", "langs": ["Français", "Anglais"], "spec": "Culture & Médina", "rate": 80, "seniority": "12 ans", "img": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100"},
        {"name": "Fatima Zahra", "city": "Fes", "langs": ["Français", "Espagnol", "Arabe"], "spec": "Histoire & Artisanat", "rate": 95, "seniority": "8 ans", "img": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100"},
        {"name": "Youssef Ait Taleb", "city": "Ouarzazate", "langs": ["Français", "Berbère"], "spec": "Trek & Désert", "rate": 75, "seniority": "15 ans", "img": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100"},
    ]
    for g in guides:
        db.execute(text("""INSERT INTO guides (id,name,city,languages,specialty,daily_rate,seniority,image_url,is_certified,status,rating,created_at,updated_at,active)
            VALUES (:id,:name,:city,:langs,:spec,:rate,:seniority,:img,true,'Available',5.0,:now,:now,true) ON CONFLICT DO NOTHING"""),
            {"id":_id(),"name":g["name"],"city":g["city"],"langs":json.dumps(g["langs"]),"spec":g["spec"],"rate":g["rate"],"seniority":g["seniority"],"img":g["img"],"now":_now()})
    db.commit()
    print(f"  ✓ {len(guides)} guides")

    print(f"  ✓ {len(sources)} data sources + 1 template report")

def main():
    print("\n  STOURS Studio — Seed Database")
    print("  " + "─"*40)
    with Session() as db:
        seed(db)
    print("\n  ✅ Done! Login: a.chakir@stours.ma / Abdo@1937\n")

if __name__ == "__main__":
    main()
