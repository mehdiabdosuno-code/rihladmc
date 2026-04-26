# RIHLA — Installation rapide

Projet livré avec :
- Backend FastAPI (Python 3.12)
- Frontend React 18 + Vite + Tailwind
- Carte interactive **Leaflet (V2 thème clair)**
- **Group Itinerary Map** : routes animées, voyageur ✈️, timeline jours, multi-groupes
- Endpoints: `/api/projects/stats/destinations` et `/api/projects/stats/groups-map`

## Démarrer

### 1) Backend
```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate          # Windows : venv\Scripts\activate
pip install -r requirements.txt
# DB SQLite locale (créée auto au 1er run)
uvicorn app.main:app --reload --port 8000
```

### 2) Seed démo (8 rôles + 5 users + 12 projets)
```bash
# dans le shell backend (venv actif)
python scripts/seed_users.py        # 5 users (super_admin, dmc_manager...)
python scripts/seed_projects.py     # 12 dossiers démo
```
Compte super_admin : **a.chakir@stours.ma / Abdo@1937**

### 3) Frontend
```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```
→ http://localhost:5173/dashboard

## Démos cartes
- **Réseau de destinations** (haut du dashboard) :
  - 14 villes Maroc, 4 circuits DMC animés, 25 activités, recherche, filtres, plein écran
- **Itinéraires des groupes** (bas du dashboard) :
  - 12 routes colorées, voyageur ✈️ animé, play/pause/0.5×–4×
  - Timeline J1…J11, multi-groupes, auto-fit, statuts WON/IN_PROGRESS/SENT/LOST

## Fichiers clés modifiés cette session
```
backend/app/modules/projects/router.py         # +2 endpoints (destinations, groups-map)
frontend/src/components/maps/InteractiveMoroccoMap.tsx   # V2 thème clair
frontend/src/components/maps/GroupItineraryMap.tsx       # NOUVEAU (~600 lignes)
frontend/src/lib/api.ts                        # +types MapData, GroupsMapData
frontend/src/pages/DashboardPage.tsx           # branche les 2 cartes
frontend/src/index.css                         # animations rihlaPulse, rihlaFlow
frontend/package.json                          # +leaflet +react-leaflet
```
