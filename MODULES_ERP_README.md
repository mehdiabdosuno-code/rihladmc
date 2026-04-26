# 9 nouveaux modules — RIHLA / STOURS Studio

**Branche** : `feature/erp-modules` (à comparer à `master`)
**Stack** : FastAPI 0.111 · SQLAlchemy 2.0 · Pydantic v2 · React 18 · Zustand · TypeScript

Tous les modules respectent les conventions RIHLA : `app/modules/<feature>/`,
UUIDs `String(36)`, `Base + BaseMixin` partagés, JWT+RBAC existants, 11 rôles
(+ nouveau rôle `SUB_AGENT` pour le portail B2B).

---

## Vue d'ensemble

### Phase 1 — ERP / Foundation (5 modules)

| # | Module | Tables ajoutées | Endpoints | Front |
|---|---|---|---|---|
| 01 | Multi-société | `companies`, `user_companies` (+ `company_id` sur 13 tables) | `/api/companies/*` | `<CompanySwitcher/>` + `companyStore` |
| 02 | Master Data unifié | `partners`, `articles` | `/api/partners`, `/api/articles` | `partnersApi`, `articlesApi` |
| 03 | Contracting + Pricing v2 | `contracts`, `contract_seasons`, `contract_rates`, `allotments` | `/api/contracts`, `/api/pricing/calculate` | (à ajouter) |
| 04 | Document Flow | — (service-only, lit l'existant) | `/api/document-flow/projects/{id}` | `<DocumentFlow/>` SVG |
| 05 | Approval Workflow | `approval_rules`, `approval_requests`, `approval_steps` | `/api/approvals`, `/api/approval-rules` | `<ApprovalInbox/>` |

### Phase 2 — DMC Pack A (4 modules, sans dépendance externe)

| # | Module | Tables ajoutées | Endpoints | Front |
|---|---|---|---|---|
| #1 | Travel Companion (carnet client PWA) | `travel_links`, `travel_messages` | `/api/travel-links/*` (auth) · `/api/companion/{token}` (public) | `/companion/:token` (mobile-first, sans login) |
| #3 | Live Ops Cockpit (J temps réel) | — (agrégateur read-only sur `field_ops` + `projects`) | `/api/ops-cockpit` | `/operations/cockpit` (poll 20 s, KPIs, alertes, dossiers, tâches, incidents) |
| #4 | Supplier Performance Score | `supplier_incidents`, `supplier_score_snapshots` | `/api/supplier-scores`, `/api/supplier-incidents` | `supplierScoresApi` (à câbler dans Partner detail) |
| #9 | Sub-agent B2B Portal (white-label) | + colonnes `users.sub_agent_partner_id`, `projects.sub_agent_partner_id` | `/api/portal/me`, `/portal/projects`, `/portal/catalog`, `/portal/quote-requests` | `/portal` (branding dynamique du sous-agent) |

> **Phase 2 — Pack B** (modules #2 Itinerary Intelligence et #7 WhatsApp Business)
> non livrée : nécessite des credentials externes (Mapbox / Meta WABA) qui doivent
> être fournis par STOURS.

---

## Migrations Alembic

Sept nouvelles révisions, dépendantes en chaîne :

```
0005_indexes_and_constraints  ← existante
        ↓
0006_companies_multitenant    ← module 01
        ↓
0007_master_data              ← module 02
        ↓
0008_contracting              ← module 03
        ↓
0009_approvals                ← module 05
        ↓
0010_travel_companion         ← module DMC #1
        ↓
0011_supplier_scores          ← module DMC #4
        ↓
0012_sub_agent_portal         ← module DMC #9
```

> Les modules 04 (Document Flow) et DMC #3 (Live Ops Cockpit) ne créent pas de tables :
> ils consomment les schémas existants.

### Lancer les migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### Seeds initiaux (à lancer une seule fois)

```bash
# 1. Crée STOURS VOYAGES + HORIZON, enrôle les utilisateurs existants
python -m scripts.seed_companies

# 2. (Optionnel) Migrer hotels/guides/transports → partners + articles
#    Récupère d'abord l'id de STOURS depuis la sortie ci-dessus
python -m scripts.migrate_inventory_to_master_data <STOURS_COMPANY_ID>

# 3. Crée les 4 règles d'approbation par défaut
python -m scripts.seed_approval_rules <STOURS_COMPANY_ID>
```

---

## Multi-tenant — comment ça marche

1. Au login, `auth/service.login()` injecte `company_id` (par défaut) dans les claims du JWT.
2. Le `TenantMiddleware` (registré dans `app/main.py`) lit ce claim et le pose sur `request.state.company_id`.
3. Toutes les routes protégées utilisent `Depends(get_current_company_id)` pour récupérer ce tenant.
4. Le frontend ajoute le bouton `<CompanySwitcher/>` qui appelle `POST /api/companies/switch` puis recharge la page avec un nouveau token.

---

## Pricing Engine v2 — algorithme

Fonction pure : `app.modules.contracting.pricing.calculate_price()`.

**Ordre de résolution (premier match gagne)** :

1. Contrat actif `{ company, supplier, article }` couvrant la date + saison + tarif (par `rate_key` ou par fourchette `pax`).
2. Contrat actif `{ company, supplier, category }` (catégorie d'article).
3. `article.sell_price` par défaut.
4. Erreur 404 si rien.

Le moteur retourne aussi `allotment_remaining` et émet un `warnings[]` si l'allotement est insuffisant. La consommation effective se fait via `consume_allotment()` au moment de la confirmation du devis (à câbler dans `quotations/service.py`).

---

## Document Flow — graphe SVG

`<DocumentFlow projectId="..." />` produit un graphe interactif sans dépendance externe. Pour passer à React Flow + dagre plus tard, l'API `GET /api/document-flow/projects/{id}` retourne déjà la structure standard `{ nodes: [], edges: [] }`.

---

## Approval Workflow — règles JSON

Les règles utilisent un évaluateur **safe** (pas d'`eval()`) :

```json
{
  "all": [
    { "field": "total_selling", "op": "gt",  "value": 50000 },
    { "field": "currency",      "op": "eq",  "value": "MAD" }
  ]
}
```

Opérateurs : `eq | ne | gt | gte | lt | lte | in | nin | contains | starts_with`.
Combinateurs : `all | any | not`.

### Câbler une approbation depuis un workflow existant

Exemple dans `quotations/service.py` :

```python
from app.modules.approvals.service import submit_for_approval

def submit_quotation(self, q: Quotation, current_user_id: str) -> ApprovalRequest:
    return submit_for_approval(
        self.db,
        company_id=q.company_id,
        entity_type="quotation",
        entity_id=q.id,
        submitted_by=current_user_id,
        snapshot={
            "total_selling": float(q.total_selling or 0),
            "currency": "MAD",
            "status": q.status,
        },
    )
```

---

## Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/test_contracting_pricing.py \
       tests/test_approvals.py \
       tests/test_ops_cockpit.py \
       tests/test_supplier_score.py \
       tests/test_sub_agent_portal.py -v
```

Résultat attendu : **34 / 34 passent**
(5 pricing + 14 approbations + 4 ops cockpit + 7 supplier score + 4 portal B2B).

> Les autres tests existants peuvent échouer à cause d'un bug `bcrypt > 72 bytes`
> non lié à ces modules (présent sur `master`).

---

## Frontend — où ajouter les composants

| Composant | Suggestion d'emplacement |
|---|---|
| `<CompanySwitcher/>` | Header de `AppShell.tsx`, à droite du menu utilisateur |
| `<DocumentFlow projectId={id}/>` | Onglet "Flux documentaire" sur `ProjectDetailPage` |
| `<ApprovalInbox/>` | Nouvelle page `/approvals` ou drawer global |
| `OpsCockpitPage` | Route `/operations/cockpit` (déjà câblée) — ajouter au menu Direction / Ops |
| `SubAgentPortalPage` | Route `/portal` (déjà câblée) — login dédié pour les sous-agents (role=SUB_AGENT) |
| `CompanionPage` | Route publique `/companion/:token` — pas de nav, partagée par lien magique |

---

## Phase 2 — Pack DMC : routes & rôles ajoutés

```
GET  /api/travel-links               (auth)  – lister/créer liens carnet client
POST /api/travel-links               (auth)
POST /api/travel-links/{id}/revoke   (auth)
GET  /api/travel-links/project/{id}  (auth)
GET  /api/travel-links/{pid}/messages (auth)
GET  /api/companion/{token}          (PUBLIC, magic-link)
POST /api/companion/{token}/messages (PUBLIC, magic-link)

GET  /api/ops-cockpit                (auth)  – snapshot agrégé J-temps réel

GET  /api/supplier-scores            (auth)  – tous les scores triés
GET  /api/supplier-scores/{id}       (auth)
POST /api/supplier-scores/{id}/snapshot (auth)
GET  /api/supplier-scores/{id}/history (auth)
GET  /api/supplier-incidents         (auth)
POST /api/supplier-incidents         (auth)
POST /api/supplier-incidents/{id}/resolve (auth)

GET  /api/portal/me                  (role=SUB_AGENT)
GET  /api/portal/projects            (role=SUB_AGENT)
GET  /api/portal/catalog             (role=SUB_AGENT)
POST /api/portal/quote-requests      (role=SUB_AGENT)
```

Nouveau rôle : `RoleEnum.SUB_AGENT` (à seeder dans `roles` pour activer le
portail B2B). Voir `app/modules/auth/models.py`.

---

## Ce qu'il reste à faire (côté RIHLA)

- [ ] Câbler `submit_for_approval()` dans les services existants (devis, factures, contrats)
- [ ] Câbler `consume_allotment()` à la confirmation de devis
- [ ] Ajouter les routes `/companies`, `/master-data`, `/approvals`, `/operations/cockpit`,
      `/portal` à la nav (`AppShell`)
- [ ] Seeder le rôle `SUB_AGENT` et créer les premiers comptes B2B
      (User.sub_agent_partner_id pointant sur un Partner type=sub_agent)
- [ ] Marquer certains projets comme templates pour le catalogue B2B
      (`Project.tags["template"] = true`)
- [ ] Câbler le bouton "Ouvrir le carnet client" sur ProjectDetailPage (POST `/travel-links`)
- [ ] Phase 2 — Pack B : fournir les credentials Mapbox (#2) et Meta WABA (#7)

---

## Commits

```
88551f6 feat(sub-agent-portal):  module #9 DMC – white-label B2B portal
f072f44 feat(supplier-score):    module #4 DMC – Supplier Performance Score
ab0665a feat(ops-cockpit):       module #3 DMC – Live Operations Cockpit
475d39b feat(travel-companion):  module #1 DMC – client-facing PWA carnet de voyage
b6eb40b feat(approvals):         module 05  – configurable approval workflow
bc38290 feat(document-flow):     module 04  – visual project document chain
0696099 feat(contracting):       module 03  – Contracts/Seasons/Rates/Allotments + Pricing v2
962b765 feat(master-data):       module 02  – unified Partner + Article catalog
5eb9511 feat(companies):         module 01  – multi-tenancy foundation
```
