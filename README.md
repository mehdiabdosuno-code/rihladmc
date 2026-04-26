# RIHLA Tourist Platform

> **Du brief client au document prêt à envoyer — en moins de 15 minutes.**

Plateforme SaaS propriétaire de gestion de circuits et cotations pour **S'TOURS DMC Morocco**.

![Version](https://img.shields.io/badge/version-0.7-C0392B?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.12-blue?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square)
![License](https://img.shields.io/badge/license-Proprietary-red?style=flat-square)
![Tests](https://img.shields.io/badge/pricing_engine-41%2F41_tests_%E2%9C%93-success?style=flat-square)

---

## Architecture

```
rihla/
├── backend/                    # Python 3.12 + FastAPI
│   ├── app/
│   │   ├── core/               # Config, database, security, logging, sentry
│   │   ├── shared/             # Base models, schemas, exceptions
│   │   └── modules/
│   │       ├── auth/           # JWT HS256 + RBAC 6 rôles
│   │       ├── projects/       # CRUD + 5 statuts (DRAFT → WON/LOST)
│   │       ├── quotations/     # Moteur déterministe + pricing engine avancé
│   │       ├── itineraries/    # Jour/jour + génération IA Claude
│   │       ├── invoices/       # PDF layout S'TOURS + FAC-YYYY-NNNN
│   │       ├── reports/        # Report Builder + exports PDF/PPTX/XLSX/CSV
│   │       ├── references/     # Générateur refs IATA + 5 départements
│   │       └── ai/            # Claude API + token logging
│   ├── alembic/                # Migrations SQL (18 tables)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/              # 8 pages (Login, Dashboard, Projects, ...)
│   │   ├── components/         # AppShell, PageHeader, UI components
│   │   ├── stores/             # Zustand auth store
│   │   └── lib/                # API client + 9 service modules
│   ├── tailwind.config.js
│   └── vite.config.ts
├── scripts/                    # Init DB, seed data
├── docker-compose.yml          # PostgreSQL 16 + Redis 7 + API + Frontend
└── docs/                       # Brand guidelines, presentations
```

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Backend API** | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 |
| **Base de données** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Frontend** | React 18 · Vite · TypeScript · Tailwind CSS · TanStack Query v5 · Zustand |
| **Auth** | JWT HS256 + RBAC 6 rôles (super_admin → sales_agent) |
| **IA** | Anthropic Claude (génération itinéraires, 4 tons, FR/EN) |
| **Exports** | ReportLab (PDF) · python-pptx (PPTX) · openpyxl (XLSX) |
| **Infrastructure** | Docker · docker-compose · GitHub Actions CI/CD |

## Démarrage rapide

### Prérequis

- Docker + Docker Compose
- Node.js 18+ (pour le frontend en dev)
- Python 3.12+ (pour le backend en dev)

### Docker (recommandé)

```bash
git clone https://github.com/your-org/rihla.git
cd rihla

# Optionnel: clé Anthropic pour l'IA
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env

# Lancer
docker compose up

# Frontend: http://localhost:5173
# API:      http://localhost:8000
# Docs:     http://localhost:8000/docs
```

Pour la production : voir [`QUICKSTART.md`](QUICKSTART.md).

### Développement local

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (nouveau terminal)
cd frontend
npm install
npm run dev
```

### Compte admin par défaut

```
Email:    a.chakir@stours.ma
Password: Abdo@1937
```

## Modules

### 1. Moteur de cotation DMC avancé (v0.5)

Le cœur du système. Calcul déterministe avec **règle critique : toujours basé sur MIN pax**.

```
POST /api/quotations/engine/calculate
```

**Catégories supportées :**

| Catégorie | Formule |
|-----------|---------|
| Hôtel | prix_chambre ÷ occupancy × nuits |
| Transport | ceil(min_pax ÷ capacité) × prix × jours ÷ min_pax |
| Guide | coût_jour × jours ÷ min_pax |
| Activité | per_person direct OU total ÷ min_pax |
| Taxi | petit (3 pl.) ou grand (7 pl.) avec ceil |
| 4×4 | capacité 4 forcée |

**Tests :** 41/41 passants

```bash
python backend/app/modules/quotations/test_pricing_engine.py
```

### 2. Itinéraires IA — Génération Claude (4 tons, FR/EN)
### 3. Facturation PDF — Layout S'TOURS, FAC-YYYY-NNNN, acompte 30%
### 4. Report Builder — KPI, graphiques, 4 formats d'export
### 5. Générateur de références — Format IATA, 16 aéroports, 5 départements
### 6. Auth RBAC — JWT 24h, 6 rôles granulaires

## API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion JWT |
| POST | `/api/quotations/engine/calculate` | Moteur DMC multi-ranges |
| GET | `/api/quotations/engine/presets` | Presets véhicules/occupancies |
| POST | `/api/itineraries/{id}/days/{dayId}/generate-ai` | Génération IA |
| POST | `/api/invoices/{id}/generate-pdf` | Génération PDF facture |
| POST | `/api/reports/export` | Export multi-format |
| POST | `/api/references/generate` | Générateur de références |
| GET | `/api/health` | Healthcheck |

## Variables d'environnement

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/rihla
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key-here
ANTHROPIC_API_KEY=sk-ant-...
CORS_ORIGINS=http://localhost:5173
SENTRY_DSN=https://...@sentry.io/...
```

## Charte graphique

| Couleur | Hex | Usage |
|---------|-----|-------|
| Rouge S'TOURS | `#A8371D` | Accents, CTA |
| Bleu Navy | `#1628A9` | Liens, headers |
| Gris Foncé | `#141414` | Texte principal |
| Crème | `#FFFEE9` | Surfaces |

## Roadmap

- [x] v0.1–0.3 — Auth, Projects, Quotations, Reports, References
- [x] v0.4 — Itineraries AI, Invoicing PDF, RIHLA rebrand
- [x] v0.5 — DMC pricing engine (41 tests, transport ceil)
- [ ] v0.6 — Project detail page, PPTX generation, CI/CD
- [ ] v1.0 — Mobile PWA, multi-langues, Whisper transcription

## License

Proprietary — © 2026 S'TOURS DMC Morocco. All rights reserved.

**Contact :** CHAKIR Abdelwahed · a.chakir@stours.ma · +212 522 95 40 00
