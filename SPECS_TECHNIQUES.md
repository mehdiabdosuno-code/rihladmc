# RIHLA — Spécification Technique Complète
> Plateforme de gestion de tours touristiques · Version 1.0 · Avril 2026

---

## TABLE DES MATIÈRES

1. [Architecture Technique](#1-architecture-technique)
2. [Schéma SQL Complet](#2-schéma-sql-complet)
3. [API REST Complète](#3-api-rest-complète)
4. [Flow WebSocket Temps Réel](#4-flow-websocket-temps-réel)
5. [Logique Métier — Rapports Emoji](#5-logique-métier--rapports-emoji)
6. [Génération PDF Dossier Guide](#6-génération-pdf-dossier-guide)
7. [Système de Notifications Push](#7-système-de-notifications-push)
8. [Sécurité & RBAC](#8-sécurité--rbac)
9. [Plan de Développement MVP](#9-plan-de-développement-mvp)

---

## 1. ARCHITECTURE TECHNIQUE

### 1.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│                                                                  │
│  ┌──────────────────┐          ┌──────────────────────────────┐ │
│  │  Web App (TD /   │          │  Mobile App (Guide)          │ │
│  │  Comptable)      │          │  React Native + Expo         │ │
│  │  React.js +      │          │  iOS / Android               │ │
│  │  Tailwind CSS    │          │                              │ │
│  └────────┬─────────┘          └──────────────┬───────────────┘ │
└───────────┼────────────────────────────────────┼────────────────┘
            │ HTTPS / WSS                        │ HTTPS / WSS
            ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX (Reverse Proxy / TLS)                  │
│                     Rate Limiting · CORS · Load Balancing        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────────┐  ┌─────────┐  ┌──────────────┐
     │  API Server    │  │ WS      │  │  PDF Service │
     │  Node.js /     │  │ Server  │  │  Node.js     │
     │  Express       │  │ Socket  │  │  + Puppeteer │
     │  (REST)        │  │  .io    │  │  / PDFKit    │
     └───────┬────────┘  └────┬────┘  └──────┬───────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
     ┌──────────────┐  ┌──────────┐   ┌──────────────────┐
     │  PostgreSQL  │  │  Redis   │   │  AWS S3          │
     │  (données    │  │  (cache  │   │  (PDF, vouchers, │
     │  principal)  │  │  + queues│   │  photos)         │
     │              │  │  + pub/  │   │                  │
     │              │  │  sub)    │   │                  │
     └──────────────┘  └──────────┘   └──────────────────┘
              │
              ▼
     ┌──────────────────────────────────────────┐
     │  Services Externes                        │
     │  ┌──────────────┐  ┌────────────────┐    │
     │  │  Firebase    │  │  Anthropic     │    │
     │  │  FCM (Push)  │  │  Claude API    │    │
     │  └──────────────┘  └────────────────┘    │
     │  ┌──────────────┐  ┌────────────────┐    │
     │  │  API bancaire│  │  SMTP (emails) │    │
     │  │  CIH / BMCE  │  │  Mailgun       │    │
     │  └──────────────┘  └────────────────┘    │
     └──────────────────────────────────────────┘
```

### 1.2 Choix Technologiques Justifiés

| Couche | Technologie | Justification |
|--------|------------|---------------|
| Frontend Web | React.js 18 + Tailwind CSS | Écosystème mature, composants réutilisables, Tailwind évite CSS sprawl |
| Mobile | React Native + Expo | Code partagé iOS/Android, accès FCM natif, déploiement rapide |
| Backend | Node.js 20 + Express | Même langage frontend/backend, excellent support WebSocket, non-bloquant pour I/O temps réel |
| BDD | PostgreSQL 16 | ACID, JSONB pour rapports emoji flexibles, UUID natif, full-text search, triggers |
| Cache / Queue | Redis 7 | Pub/Sub pour Socket.io multi-instance, queue alertes, sessions JWT blacklist |
| Temps réel | Socket.io 4 | Fallback automatique (WebSocket → polling), rooms par dossier, reconnexion auto |
| PDF | Puppeteer + Handlebars | Templates HTML complexes avec styles, fidèles au rendu visuel |
| Push | Firebase FCM | Support iOS + Android unifié, livraison garantie, free tier généreux |
| Stockage | AWS S3 | Durabilité 99.999999999%, CDN via CloudFront, URLs signées sécurisées |
| IA | Anthropic Claude API | Qualité rédaction supérieure pour évaluations, streaming support |
| Auth | JWT + Refresh Tokens | Stateless, adapté mobile, refresh token rotation pour sécurité |
| Monitoring | Prometheus + Grafana | Métriques alertes < 3s, latence WebSocket |

---

## 2. SCHÉMA SQL COMPLET

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TYPES ÉNUMÉRÉS
-- ============================================================
CREATE TYPE role_utilisateur AS ENUM ('TD', 'guide', 'comptable', 'client', 'admin');
CREATE TYPE statut_dossier AS ENUM ('brouillon', 'confirme', 'pret', 'en_cours', 'termine', 'archive');
CREATE TYPE type_prestataire AS ENUM ('hotel', 'restaurant', 'activite', 'transport', 'autre');
CREATE TYPE emoji_evaluation AS ENUM ('bien', 'moyen', 'mauvais');
CREATE TYPE statut_paiement AS ENUM ('en_attente', 'effectue', 'confirme', 'rejete');
CREATE TYPE type_notification AS ENUM ('checklist_j1', 'alerte_rapport', 'paiement', 'message', 'evaluation');

-- ============================================================
-- TABLE : utilisateurs
-- ============================================================
CREATE TABLE utilisateurs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe    VARCHAR(255) NOT NULL,  -- bcrypt hash
    role            role_utilisateur NOT NULL,
    telephone       VARCHAR(20),
    photo_url       TEXT,
    fcm_token       TEXT,                   -- Firebase token pour push
    actif           BOOLEAN DEFAULT TRUE,
    derniere_connexion TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);

-- ============================================================
-- TABLE : refresh_tokens (gestion sessions)
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoque     BOOLEAN DEFAULT FALSE,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================
-- TABLE : prestataires
-- ============================================================
CREATE TABLE prestataires (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom             VARCHAR(200) NOT NULL,
    type            type_prestataire NOT NULL,
    ville           VARCHAR(100),
    adresse         TEXT,
    telephone       VARCHAR(20),
    telephone_urgence VARCHAR(20),
    email           VARCHAR(255),
    notes           TEXT,
    actif           BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prestataires_type ON prestataires(type);
CREATE INDEX idx_prestataires_ville ON prestataires(ville);

-- ============================================================
-- TABLE : dossiers
-- ============================================================
CREATE TABLE dossiers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_dossier  VARCHAR(50) NOT NULL UNIQUE,  -- ex: DOS-2026-0042
    nom_groupe      VARCHAR(200) NOT NULL,
    date_debut      DATE NOT NULL,
    date_fin        DATE NOT NULL,
    statut          statut_dossier NOT NULL DEFAULT 'brouillon',
    td_id           UUID NOT NULL REFERENCES utilisateurs(id),
    guide_id        UUID REFERENCES utilisateurs(id),
    nb_participants INTEGER DEFAULT 0,
    notes_internes  TEXT,
    pdf_url         TEXT,                          -- URL S3 du dossier guide PDF
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_dates CHECK (date_fin >= date_debut)
);

CREATE INDEX idx_dossiers_td ON dossiers(td_id);
CREATE INDEX idx_dossiers_guide ON dossiers(guide_id);
CREATE INDEX idx_dossiers_statut ON dossiers(statut);
CREATE INDEX idx_dossiers_dates ON dossiers(date_debut, date_fin);

-- Génération automatique numéro dossier
CREATE SEQUENCE seq_numero_dossier START 1;
CREATE OR REPLACE FUNCTION generer_numero_dossier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_dossier IS NULL OR NEW.numero_dossier = '' THEN
        NEW.numero_dossier := 'DOS-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                               LPAD(NEXTVAL('seq_numero_dossier')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_dossier
    BEFORE INSERT ON dossiers
    FOR EACH ROW EXECUTE FUNCTION generer_numero_dossier();

-- ============================================================
-- TABLE : programmes
-- ============================================================
CREATE TABLE programmes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id  UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    jour        INTEGER NOT NULL,           -- Jour 1, 2, 3...
    date        DATE NOT NULL,
    titre       VARCHAR(200),
    description TEXT,
    ordre       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dossier_id, jour)
);

CREATE INDEX idx_programmes_dossier ON programmes(dossier_id);

-- ============================================================
-- TABLE : programme_items (détail de chaque activité du jour)
-- ============================================================
CREATE TABLE programme_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id    UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    type            type_prestataire NOT NULL,
    prestataire_id  UUID REFERENCES prestataires(id),
    prestataire_nom VARCHAR(200),           -- dénormalisé pour historique
    heure_debut     TIME,
    heure_fin       TIME,
    lieu            VARCHAR(200),
    notes           TEXT,
    ordre           INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programme_items_programme ON programme_items(programme_id);
CREATE INDEX idx_programme_items_dossier ON programme_items(dossier_id);

-- ============================================================
-- TABLE : checklist_24h
-- ============================================================
CREATE TABLE checklist_24h (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id              UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE UNIQUE,
    appel_restaurants       BOOLEAN DEFAULT FALSE,
    appel_hotels            BOOLEAN DEFAULT FALSE,
    appel_activites         BOOLEAN DEFAULT FALSE,
    dossier_guide_pret      BOOLEAN DEFAULT FALSE,
    valide_par              UUID REFERENCES utilisateurs(id),
    valide_at               TIMESTAMPTZ,
    notes                   TEXT,
    notification_envoyee    BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : marquer dossier "prêt" quand checklist complète
CREATE OR REPLACE FUNCTION maj_statut_apres_checklist()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appel_restaurants = TRUE 
       AND NEW.appel_hotels = TRUE 
       AND NEW.appel_activites = TRUE 
       AND NEW.dossier_guide_pret = TRUE 
       AND OLD.dossier_guide_pret = FALSE THEN
        UPDATE dossiers SET statut = 'pret', updated_at = NOW()
        WHERE id = NEW.dossier_id AND statut = 'confirme';
        NEW.valide_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checklist_statut
    BEFORE UPDATE ON checklist_24h
    FOR EACH ROW EXECUTE FUNCTION maj_statut_apres_checklist();

-- ============================================================
-- TABLE : rapports_journaliers
-- ============================================================
CREATE TABLE rapports_journaliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    guide_id        UUID NOT NULL REFERENCES utilisateurs(id),
    jour            INTEGER NOT NULL,
    date_rapport    DATE NOT NULL,

    -- Évaluations emoji
    petit_dejeuner  emoji_evaluation,
    dejeuner        emoji_evaluation,
    diner           emoji_evaluation,
    hotel           emoji_evaluation,
    transport       emoji_evaluation,
    accueil_hote    emoji_evaluation,

    commentaire     TEXT,
    alerte_envoyee  BOOLEAN DEFAULT FALSE,
    categories_alertes TEXT[],              -- ex: ['hotel', 'transport']
    soumis_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dossier_id, jour)
);

CREATE INDEX idx_rapports_dossier ON rapports_journaliers(dossier_id);
CREATE INDEX idx_rapports_guide ON rapports_journaliers(guide_id);
CREATE INDEX idx_rapports_alerte ON rapports_journaliers(alerte_envoyee) WHERE alerte_envoyee = FALSE;

-- ============================================================
-- TABLE : paiements_guides
-- IMPORTANT : Traçabilité virements bancaires uniquement.
-- Les bons physiques (espèces terrain) sont HORS BDD.
-- ============================================================
CREATE TABLE paiements_guides (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id          UUID NOT NULL REFERENCES dossiers(id),
    guide_id            UUID NOT NULL REFERENCES utilisateurs(id),
    montant             DECIMAL(10, 2) NOT NULL,
    devise              VARCHAR(3) DEFAULT 'MAD',
    reference_bancaire  VARCHAR(100) UNIQUE,
    statut              statut_paiement NOT NULL DEFAULT 'en_attente',
    effectue_par        UUID NOT NULL REFERENCES utilisateurs(id),  -- comptable
    note                TEXT,
    confirme_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_montant_positif CHECK (montant > 0)
);

CREATE INDEX idx_paiements_dossier ON paiements_guides(dossier_id);
CREATE INDEX idx_paiements_guide ON paiements_guides(guide_id);
CREATE INDEX idx_paiements_statut ON paiements_guides(statut);

-- ============================================================
-- TABLE : evaluations_guides
-- ============================================================
CREATE TABLE evaluations_guides (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id  UUID NOT NULL REFERENCES dossiers(id),
    guide_id    UUID NOT NULL REFERENCES utilisateurs(id),
    td_id       UUID NOT NULL REFERENCES utilisateurs(id),
    note        DECIMAL(3,1) NOT NULL,      -- /10, ex: 8.5
    critique    TEXT NOT NULL,
    source_aide VARCHAR(50),               -- 'claude' | 'manuel'
    brouillon   TEXT,                      -- brouillon généré par Claude avant validation
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(dossier_id, guide_id),
    CONSTRAINT chk_note CHECK (note >= 0 AND note <= 10)
);

CREATE INDEX idx_evaluations_guide ON evaluations_guides(guide_id);

-- ============================================================
-- TABLE : messages (chat TD ↔ Guide)
-- ============================================================
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id  UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    expediteur_id UUID NOT NULL REFERENCES utilisateurs(id),
    destinataire_id UUID NOT NULL REFERENCES utilisateurs(id),
    contenu     TEXT NOT NULL,
    lu          BOOLEAN DEFAULT FALSE,
    lu_at       TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_dossier ON messages(dossier_id);
CREATE INDEX idx_messages_participants ON messages(expediteur_id, destinataire_id);
CREATE INDEX idx_messages_non_lus ON messages(destinataire_id, lu) WHERE lu = FALSE;

-- ============================================================
-- TABLE : notifications
-- ============================================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type            type_notification NOT NULL,
    titre           VARCHAR(255) NOT NULL,
    corps           TEXT,
    dossier_id      UUID REFERENCES dossiers(id),
    rapport_id      UUID REFERENCES rapports_journaliers(id),
    lu              BOOLEAN DEFAULT FALSE,
    lu_at           TIMESTAMPTZ,
    push_envoye     BOOLEAN DEFAULT FALSE,
    push_envoye_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, lu);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================
-- TABLE : audit_log (traçabilité toutes actions sensibles)
-- ============================================================
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES utilisateurs(id),
    action      VARCHAR(100) NOT NULL,      -- ex: 'PAIEMENT_EFFECTUE', 'DOSSIER_MODIFIE'
    entite      VARCHAR(50),                -- ex: 'paiements_guides'
    entite_id   UUID,
    ancien_val  JSONB,
    nouveau_val JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entite ON audit_log(entite, entite_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- ============================================================
-- TRIGGER : updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION maj_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['utilisateurs','dossiers','programmes','checklist_24h',
                              'paiements_guides','evaluations_guides','prestataires']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_updated_at_%s
            BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION maj_updated_at()', t, t);
    END LOOP;
END;
$$;
```

---

## 3. API REST COMPLÈTE

### 3.1 Conventions Générales

```
Base URL : https://api.rihla.ma/v1
Auth     : Bearer {JWT} dans header Authorization
Content  : application/json
Errors   : { "error": { "code": "ERR_CODE", "message": "...", "details": {} } }
```

**Codes d'erreur standardisés :**

| Code HTTP | Code interne | Signification |
|-----------|-------------|---------------|
| 400 | VALIDATION_ERROR | Corps requête invalide |
| 401 | UNAUTHORIZED | Token absent ou expiré |
| 403 | FORBIDDEN | Rôle insuffisant |
| 404 | NOT_FOUND | Ressource introuvable |
| 409 | CONFLICT | Conflit (doublon) |
| 422 | UNPROCESSABLE | Règle métier violée |
| 500 | INTERNAL_ERROR | Erreur serveur |

---

### 3.2 Authentification

#### `POST /auth/login`
```json
// REQUEST
{
  "email": "td@rihla.ma",
  "password": "motdepasse"
}

// RESPONSE 200
{
  "access_token": "eyJhbGc...",   // expire dans 15min
  "refresh_token": "eyJhbGc...", // expire dans 30 jours
  "user": {
    "id": "uuid",
    "nom": "Benali",
    "prenom": "Youssef",
    "email": "td@rihla.ma",
    "role": "TD",
    "photo_url": "https://..."
  }
}
```

#### `POST /auth/refresh`
```json
// REQUEST
{ "refresh_token": "eyJhbGc..." }

// RESPONSE 200
{ "access_token": "eyJhbGc..." }
```

#### `POST /auth/logout`
```json
// REQUEST (header: Authorization: Bearer {token})
{ "refresh_token": "eyJhbGc..." }

// RESPONSE 204  (no content)
```

#### `GET /auth/me`
```json
// RESPONSE 200
{
  "id": "uuid",
  "nom": "Benali",
  "role": "TD",
  "notifications_non_lues": 3
}
```

---

### 3.3 Dossiers

#### `GET /dossiers`
Rôles : TD, comptable, admin

Query params : `?statut=confirme&page=1&limit=20&search=groupe+nom`

```json
// RESPONSE 200
{
  "data": [
    {
      "id": "uuid",
      "numero_dossier": "DOS-2026-0042",
      "nom_groupe": "Famille Dupont",
      "date_debut": "2026-05-10",
      "date_fin": "2026-05-17",
      "statut": "confirme",
      "td": { "id": "uuid", "nom": "Benali Youssef" },
      "guide": { "id": "uuid", "nom": "Idrissi Karim" },
      "nb_participants": 6,
      "jours_restants": 15
    }
  ],
  "pagination": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
}
```

#### `POST /dossiers`
Rôles : TD

```json
// REQUEST
{
  "nom_groupe": "Famille Dupont",
  "date_debut": "2026-05-10",
  "date_fin": "2026-05-17",
  "guide_id": "uuid",
  "nb_participants": 6,
  "notes_internes": "Groupe VIP, allergies alimentaires"
}

// RESPONSE 201
{
  "id": "uuid",
  "numero_dossier": "DOS-2026-0042",
  "statut": "brouillon",
  ...
}
```

#### `GET /dossiers/:id`
```json
// RESPONSE 200
{
  "id": "uuid",
  "numero_dossier": "DOS-2026-0042",
  "nom_groupe": "Famille Dupont",
  "statut": "confirme",
  "td": { ... },
  "guide": { ... },
  "programmes": [...],     // résumé jours
  "checklist": { ... },    // état checklist 24h
  "derniers_rapports": [...],
  "paiement": { ... }
}
```

#### `PATCH /dossiers/:id`
Rôles : TD (propriétaire)

```json
// REQUEST (champs partiels acceptés)
{ "statut": "confirme", "guide_id": "uuid" }

// RESPONSE 200 — dossier mis à jour
```

#### `DELETE /dossiers/:id`
Rôles : admin uniquement. Soft-delete (statut → 'archive').

---

### 3.4 Programmes

#### `GET /dossiers/:id/programme`
```json
// RESPONSE 200
[
  {
    "id": "uuid",
    "jour": 1,
    "date": "2026-05-10",
    "titre": "Arrivée à Marrakech",
    "items": [
      {
        "id": "uuid",
        "type": "hotel",
        "prestataire": {
          "id": "uuid",
          "nom": "Riad La Sultana",
          "telephone": "+212524388008"
        },
        "heure_debut": "14:00",
        "lieu": "Médina, Marrakech"
      }
    ]
  }
]
```

#### `PUT /dossiers/:id/programme`
Rôles : TD — remplace le programme complet

```json
// REQUEST
{
  "jours": [
    {
      "jour": 1,
      "date": "2026-05-10",
      "titre": "Arrivée",
      "items": [
        {
          "type": "hotel",
          "prestataire_id": "uuid",
          "heure_debut": "14:00",
          "notes": "Check-in à partir de 14h"
        }
      ]
    }
  ]
}

// RESPONSE 200
```

---

### 3.5 Checklist J-1

#### `GET /dossiers/:id/checklist`
```json
// RESPONSE 200
{
  "dossier_id": "uuid",
  "appel_restaurants": false,
  "appel_hotels": true,
  "appel_activites": false,
  "dossier_guide_pret": false,
  "valide_par": null,
  "valide_at": null,
  "complete": false
}
```

#### `PATCH /dossiers/:id/checklist`
Rôles : TD propriétaire du dossier

```json
// REQUEST
{
  "appel_restaurants": true,
  "notes": "Rest. Al Fassia OK, rest. Nomad OK"
}

// RESPONSE 200
{
  "appel_restaurants": true,
  "appel_hotels": true,
  "appel_activites": false,
  "dossier_guide_pret": false,
  "complete": false     // true seulement si tout coché
}
```

---

### 3.6 Rapports Journaliers

#### `POST /dossiers/:id/rapports`
Rôles : guide assigné au dossier

```json
// REQUEST
{
  "jour": 3,
  "date_rapport": "2026-05-12",
  "petit_dejeuner": "bien",
  "dejeuner": "moyen",
  "diner": "mauvais",
  "hotel": "bien",
  "transport": "bien",
  "accueil_hote": "bien",
  "commentaire": "Le dîner au restaurant Tanjia était insuffisant en quantité. Clients mécontents."
}

// RESPONSE 201
{
  "id": "uuid",
  "alerte_declenchee": true,
  "categories_alertes": ["diner"],
  "message": "Rapport soumis. Alerte envoyée au TD pour : dîner"
}
```

#### `GET /dossiers/:id/rapports`
Rôles : TD, guide (propre dossier)

```json
// RESPONSE 200
[
  {
    "id": "uuid",
    "jour": 3,
    "date_rapport": "2026-05-12",
    "evaluations": {
      "petit_dejeuner": { "valeur": "bien", "emoji": "😊" },
      "dejeuner":       { "valeur": "moyen", "emoji": "😐" },
      "diner":          { "valeur": "mauvais", "emoji": "😞" },
      "hotel":          { "valeur": "bien", "emoji": "😊" },
      "transport":      { "valeur": "bien", "emoji": "😊" },
      "accueil_hote":   { "valeur": "bien", "emoji": "😊" }
    },
    "score_global": 4.3,
    "commentaire": "...",
    "alerte_envoyee": true,
    "categories_alertes": ["diner"]
  }
]
```

#### `GET /dossiers/:id/rapports/:jour`
Détail d'un rapport spécifique.

---

### 3.7 Paiements Guides

#### `POST /paiements`
Rôles : comptable uniquement

```json
// REQUEST
{
  "dossier_id": "uuid",
  "guide_id": "uuid",
  "montant": 2500.00,
  "devise": "MAD",
  "reference_bancaire": "VIR-BMCE-2026042501",
  "note": "Paiement tour printemps Famille Dupont"
}

// RESPONSE 201
{
  "id": "uuid",
  "dossier_id": "uuid",
  "numero_dossier": "DOS-2026-0042",
  "nom_groupe": "Famille Dupont",
  "guide": { "id": "uuid", "nom": "Idrissi Karim" },
  "montant": 2500.00,
  "devise": "MAD",
  "reference_bancaire": "VIR-BMCE-2026042501",
  "statut": "effectue",
  "effectue_par": { "id": "uuid", "nom": "Tahiri Omar" },
  "created_at": "2026-04-25T10:30:00Z"
}
```

#### `GET /paiements`
Rôles : comptable, admin

Query : `?guide_id=uuid&dossier_id=uuid&statut=effectue`

#### `GET /paiements/:id`

#### `PATCH /paiements/:id/confirmer`
Rôles : admin — confirme réception côté bancaire

```json
// REQUEST
{ "note": "Confirmé par banque le 25/04/2026" }

// RESPONSE 200 — statut → "confirme"
```

---

### 3.8 Évaluations Guides

#### `POST /guides/:id/evaluations`
Rôles : TD

```json
// REQUEST
{
  "dossier_id": "uuid",
  "note": 8.5,
  "critique": "Excellent guide, très professionnel...",
  "source_aide": "claude"
}

// RESPONSE 201
{
  "id": "uuid",
  "guide_id": "uuid",
  "note": 8.5,
  "critique": "...",
  "source_aide": "claude",
  "created_at": "..."
}
```

#### `GET /guides/:id/evaluations`
Historique complet des évaluations du guide.

#### `POST /guides/:id/evaluations/generer`
Rôles : TD — appel Claude API

```json
// REQUEST
{
  "dossier_id": "uuid",
  "ton": "professionnel",     // professionnel | constructif | encourageant
  "langue": "fr"
}

// RESPONSE 200
{
  "brouillon": "Guide Karim a démontré une excellente maîtrise...",
  "note_suggeree": 8.5,
  "points_forts": ["ponctualité", "connaissance culturelle"],
  "points_amelioration": ["communication avec prestataires"]
}
```

---

### 3.9 PDF Dossier Guide

#### `POST /dossiers/:id/pdf/generer`
Rôles : TD

```json
// RESPONSE 202 (async)
{
  "job_id": "uuid",
  "status": "en_traitement",
  "webhook": "/dossiers/{id}/pdf/statut"
}
```

#### `GET /dossiers/:id/pdf/statut`
```json
// RESPONSE 200
{
  "status": "pret",    // en_traitement | pret | erreur
  "url": "https://s3.amazonaws.com/rihla/pdfs/DOS-2026-0042.pdf",
  "expire_at": "2026-05-01T00:00:00Z"  // URL signée S3, 7 jours
}
```

#### `GET /dossiers/:id/pdf/telecharger`
Redirect vers l'URL S3 signée.

---

### 3.10 Notifications

#### `GET /notifications`
Rôles : tous

```json
// RESPONSE 200
{
  "data": [
    {
      "id": "uuid",
      "type": "alerte_rapport",
      "titre": "ALERTE : Dîner mauvais — DOS-2026-0042 Jour 3",
      "corps": "Guide Idrissi signale un problème au dîner. Famille Dupont.",
      "dossier_id": "uuid",
      "lu": false,
      "created_at": "2026-05-12T21:45:00Z"
    }
  ],
  "non_lues": 2
}
```

#### `PATCH /notifications/:id/lire`
Marque comme lue.

#### `PATCH /notifications/lire-tout`

---

### 3.11 Prestataires

#### `GET /prestataires`
Query : `?type=hotel&ville=Marrakech&search=riad`

#### `POST /prestataires`
#### `GET /prestataires/:id`
#### `PATCH /prestataires/:id`
#### `DELETE /prestataires/:id`

---

## 4. FLOW WEBSOCKET TEMPS RÉEL

### 4.1 Architecture Socket.io

```
Client (TD Web / Guide Mobile)
        │
        │  connect + auth JWT
        ▼
  Socket.io Server
        │
        ├── join room : dossier:{dossier_id}
        ├── join room : user:{user_id}
        │
        └── Redis Pub/Sub (adapter multi-instance)
```

### 4.2 Événements Client → Serveur

```javascript
// Rejoindre un dossier (obligatoire après connexion)
socket.emit('rejoindre_dossier', {
  dossier_id: 'uuid'
});

// Envoyer un message
socket.emit('envoyer_message', {
  dossier_id: 'uuid',
  destinataire_id: 'uuid',
  contenu: 'Texte du message'
});

// Indiquer "en train d'écrire"
socket.emit('typing', {
  dossier_id: 'uuid',
  typing: true
});
```

### 4.3 Événements Serveur → Client

```javascript
// Confirmation de connexion
socket.on('connecte', {
  user_id: 'uuid',
  rooms: ['dossier:uuid', 'user:uuid']
});

// Nouveau rapport soumis (TD reçoit immédiatement)
socket.on('nouveau_rapport', {
  dossier_id: 'uuid',
  rapport: {
    id: 'uuid',
    jour: 3,
    guide: { id: 'uuid', nom: 'Idrissi Karim' },
    evaluations: { ... },
    alerte: true,
    categories_alertes: ['diner']
  }
});

// Alerte critique (émis en parallèle du nouveau_rapport)
socket.on('alerte_critique', {
  dossier_id: 'uuid',
  numero_dossier: 'DOS-2026-0042',
  nom_groupe: 'Famille Dupont',
  jour: 3,
  categories: ['diner'],
  message: 'Dîner signalé comme mauvais par le guide',
  guide_telephone: '+212600000000',
  timestamp: '2026-05-12T21:45:00Z'
});

// Nouveau message chat
socket.on('nouveau_message', {
  id: 'uuid',
  dossier_id: 'uuid',
  expediteur: { id: 'uuid', nom: 'Benali Youssef', role: 'TD' },
  contenu: 'Comment puis-je vous aider ?',
  created_at: '...'
});

// Indication de frappe
socket.on('typing', {
  dossier_id: 'uuid',
  user_id: 'uuid',
  nom: 'Benali Youssef',
  typing: true
});

// Message lu
socket.on('message_lu', {
  message_id: 'uuid',
  lu_par: 'uuid',
  lu_at: '...'
});

// Mise à jour statut paiement (guide reçoit)
socket.on('paiement_effectue', {
  id: 'uuid',
  montant: 2500,
  devise: 'MAD',
  reference: 'VIR-BMCE-...',
  dossier: 'DOS-2026-0042'
});
```

### 4.4 Flow Complet Rapport Emoji (< 3 secondes)

```
Guide (app mobile)
    │
    │ POST /api/dossiers/:id/rapports
    ▼
API Server
    ├─ [1] Validation données
    ├─ [2] INSERT rapports_journaliers → PostgreSQL
    ├─ [3] Détecter catégories 'mauvais'
    ├─ [4] Si alerte :
    │   ├─ [4a] INSERT notifications → PostgreSQL
    │   ├─ [4b] PUBLISH redis channel 'alerte:{dossier_id}'
    │   └─ [4c] Enqueue FCM job → Redis Queue (Bull)
    ├─ [5] PUBLISH redis channel 'rapport:{dossier_id}'
    └─ [6] Répondre 201 au guide

Redis Pub/Sub
    │
    ├─ Socket.io Server reçoit 'rapport:{dossier_id}'
    │   └─ emit('nouveau_rapport') → room dossier:{id}  ← TD reçoit
    │
    ├─ Socket.io Server reçoit 'alerte:{dossier_id}'
    │   └─ emit('alerte_critique') → room user:{td_id}  ← TD reçoit
    │
    └─ FCM Worker reçoit job
        └─ Firebase API → push notification sur device TD  ← TD notifié

Temps total ≈ 200-500ms (objectif < 3s largement atteint)
```

### 4.5 Gestion Déconnexion / Reconnexion

```javascript
// Côté client — reconnexion automatique Socket.io
const socket = io('wss://api.rihla.ma', {
  auth: { token: accessToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});

// Au reconnect, rejoindre les rooms actives
socket.on('connect', () => {
  activeDossiers.forEach(id => {
    socket.emit('rejoindre_dossier', { dossier_id: id });
  });
});

// Côté serveur — gestion auth WebSocket
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = verifyJWT(token);
    socket.data.user = payload;
    next();
  } catch (err) {
    next(new Error('UNAUTHORIZED'));
  }
});
```

---

## 5. LOGIQUE MÉTIER — RAPPORTS EMOJI

### 5.1 Mapping Valeurs

```javascript
// constants/rapport.js
const EMOJI_MAP = {
  bien:   { emoji: '😊', valeur: 2, label: 'Bien' },
  moyen:  { emoji: '😐', valeur: 1, label: 'Moyen' },
  mauvais:{ emoji: '😞', valeur: 0, label: 'Mauvais', alerte: true }
};

const CATEGORIES = [
  'petit_dejeuner',
  'dejeuner',
  'diner',
  'hotel',
  'transport',
  'accueil_hote'
];

const LABELS_FR = {
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  hotel: 'Hôtel',
  transport: 'Transport',
  accueil_hote: 'Accueil / Hôte'
};
```

### 5.2 Détection et Déclenchement Alerte

```javascript
// services/rapportService.js

async function soumettreRapport(dossierId, guideId, data) {
  // 1. Calculer score global
  const scores = CATEGORIES
    .filter(cat => data[cat])
    .map(cat => EMOJI_MAP[data[cat]].valeur);
  const scoreGlobal = scores.length 
    ? (scores.reduce((a, b) => a + b, 0) / scores.length / 2 * 5)
    : null;

  // 2. Identifier catégories en alerte
  const categoriesAlertes = CATEGORIES.filter(
    cat => data[cat] === 'mauvais'
  );

  const alerteDeclenchee = categoriesAlertes.length > 0;

  // 3. Insérer en BDD (transaction)
  const rapport = await db.transaction(async (trx) => {
    const [r] = await trx('rapports_journaliers').insert({
      dossier_id: dossierId,
      guide_id: guideId,
      ...data,
      categories_alertes: categoriesAlertes,
      alerte_envoyee: false
    }).returning('*');

    return r;
  });

  // 4. Déclencher alerte si nécessaire (async, non-bloquant)
  if (alerteDeclenchee) {
    setImmediate(() => declencherAlerte(rapport, categoriesAlertes));
  }

  // 5. Diffuser via WebSocket (tous les abonnés du dossier)
  redis.publish(`rapport:${dossierId}`, JSON.stringify({
    type: 'nouveau_rapport',
    rapport,
    alerteDeclenchee,
    categoriesAlertes,
    scoreGlobal
  }));

  return { rapport, alerteDeclenchee, categoriesAlertes };
}

async function declencherAlerte(rapport, categories) {
  const dossier = await getDossierAvecTD(rapport.dossier_id);

  const labelsCategories = categories.map(c => LABELS_FR[c]).join(', ');
  const titre = `⚠️ ALERTE — ${dossier.numero_dossier} Jour ${rapport.jour}`;
  const corps = `Problème signalé : ${labelsCategories}. Groupe : ${dossier.nom_groupe}`;

  // 5a. Notification BDD
  await db('notifications').insert({
    user_id: dossier.td_id,
    type: 'alerte_rapport',
    titre,
    corps,
    dossier_id: rapport.dossier_id,
    rapport_id: rapport.id
  });

  // 5b. WebSocket temps réel
  redis.publish(`alerte:${rapport.dossier_id}`, JSON.stringify({
    type: 'alerte_critique',
    dossier_id: rapport.dossier_id,
    numero_dossier: dossier.numero_dossier,
    nom_groupe: dossier.nom_groupe,
    jour: rapport.jour,
    categories,
    guide_telephone: dossier.guide_telephone,
    timestamp: new Date().toISOString()
  }));

  // 5c. Push notification Firebase
  await envoyerPushNotification(dossier.td_id, {
    title: titre,
    body: corps,
    data: {
      type: 'alerte_rapport',
      dossier_id: rapport.dossier_id,
      rapport_id: rapport.id
    },
    priority: 'high',
    android: { priority: 'high', notification: { sound: 'alerte' } },
    apns: { payload: { aps: { sound: 'alerte.caf', badge: 1 } } }
  });

  // 5d. Marquer alerte envoyée
  await db('rapports_journaliers')
    .where('id', rapport.id)
    .update({ alerte_envoyee: true });
}
```

---

## 6. GÉNÉRATION PDF DOSSIER GUIDE

### 6.1 Stack et Processus

```
POST /dossiers/:id/pdf/generer
        │
        ▼
    API Server
    ├─ Valide droits TD
    ├─ Enqueue job → Bull Queue (Redis)
    └─ Retourne job_id

        │
        ▼ (worker asynchrone)
    PDF Worker (Node.js)
    ├─ Récupère données complètes dossier
    ├─ Compile template Handlebars → HTML
    ├─ Lance Puppeteer (Chromium headless)
    │   └─ page.pdf({ format: 'A4', printBackground: true })
    ├─ Upload vers S3 (clé: pdfs/{numero_dossier}.pdf)
    ├─ UPDATE dossiers SET pdf_url = ...
    └─ WebSocket notify TD → 'pdf_pret'
```

### 6.2 Structure Template Handlebars

```handlebars
<!-- templates/dossier-guide.hbs -->
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; margin: 0; color: #1a1a1a; }
    .page { padding: 40px; page-break-after: always; }
    .entete { background: #1e3a5f; color: white; padding: 20px; border-radius: 8px; }
    .jour-titre { background: #f0f4f8; border-left: 4px solid #1e3a5f; padding: 10px 16px; }
    .item { display: flex; align-items: flex-start; margin: 12px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-hotel { background: #dbeafe; color: #1e40af; }
    .badge-restaurant { background: #dcfce7; color: #166534; }
    .badge-transport { background: #fef9c3; color: #854d0e; }
    .badge-activite { background: #f3e8ff; color: #6b21a8; }
    @media print {
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>

<!-- PAGE DE GARDE -->
<div class="page">
  <div class="entete">
    <h1>DOSSIER GUIDE</h1>
    <h2>{{dossier.nom_groupe}}</h2>
    <p>Réf : {{dossier.numero_dossier}} &nbsp;|&nbsp;
       Du {{formatDate dossier.date_debut}} au {{formatDate dossier.date_fin}}</p>
  </div>
  <table style="margin-top: 30px; width: 100%;">
    <tr><td><strong>Guide :</strong></td><td>{{guide.prenom}} {{guide.nom}}</td></tr>
    <tr><td><strong>TD :</strong></td><td>{{td.prenom}} {{td.nom}}</td></tr>
    <tr><td><strong>Participants :</strong></td><td>{{dossier.nb_participants}} personnes</td></tr>
    <tr><td><strong>Durée :</strong></td><td>{{dossier.nb_jours}} jours</td></tr>
    <tr><td><strong>Téléphone TD :</strong></td><td>{{td.telephone}}</td></tr>
  </table>
  <div style="margin-top: 40px; padding: 16px; background: #fff7ed; border-left: 4px solid #f97316;">
    <strong>CONTACTS D'URGENCE</strong><br>
    Bureau : +212 5XX-XXXXXX &nbsp;|&nbsp; TD : {{td.telephone}}
  </div>
</div>

<!-- PROGRAMME JOUR PAR JOUR -->
{{#each programmes}}
<div class="page">
  <div class="jour-titre">
    <strong>JOUR {{this.jour}}</strong> — {{formatDate this.date}} — {{this.titre}}
  </div>
  {{#each this.items}}
  <div class="item">
    <span class="badge badge-{{this.type}}">{{upperCase this.type}}</span>
    <div style="margin-left: 12px;">
      <strong>{{this.prestataire_nom}}</strong>
      {{#if this.heure_debut}}
        <span style="color: #666; margin-left: 8px;">{{this.heure_debut}}{{#if this.heure_fin}} – {{this.heure_fin}}{{/if}}</span>
      {{/if}}
      {{#if this.lieu}}<div style="color: #555; font-size: 13px;">📍 {{this.lieu}}</div>{{/if}}
      {{#if this.notes}}<div style="color: #777; font-size: 12px; margin-top: 4px;">{{this.notes}}</div>{{/if}}
      {{#if this.telephone}}<div style="color: #1e3a5f; font-size: 13px;">📞 {{this.telephone}}</div>{{/if}}
    </div>
  </div>
  {{/each}}
</div>
{{/each}}

<!-- FEUILLES DE REMARQUES (3 pages vierges) -->
{{#times 3}}
<div class="page">
  <h3>REMARQUES — Jour _____ · Date : ____________</h3>
  {{#times 20}}<div style="border-bottom: 1px solid #ddd; height: 28px; margin: 4px 0;"></div>{{/times}}
  <div style="margin-top: 20px;">
    <strong>Signature Guide :</strong> _________________________ &nbsp;&nbsp;
    <strong>Date :</strong> _____________
  </div>
</div>
{{/times}}

</body>
</html>
```

### 6.3 Worker PDF

```javascript
// workers/pdfWorker.js
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Helpers Handlebars
handlebars.registerHelper('formatDate', (date) =>
  new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
);
handlebars.registerHelper('times', (n, block) => {
  let result = '';
  for (let i = 0; i < n; i++) result += block.fn(i);
  return result;
});

async function genererPDF(job) {
  const { dossierId, tdId } = job.data;

  // 1. Charger données
  const dossier = await getDossierComplet(dossierId);

  // 2. Compiler HTML
  const templateSrc = await fs.readFile('./templates/dossier-guide.hbs', 'utf8');
  const template = handlebars.compile(templateSrc);
  const html = template({ dossier, guide: dossier.guide, td: dossier.td, programmes: dossier.programmes });

  // 3. Générer PDF
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await browser.close();

  // 4. Upload S3
  const key = `pdfs/${dossier.numero_dossier}-${Date.now()}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256'
  }));

  // 5. Mettre à jour BDD
  await db('dossiers').where('id', dossierId).update({
    pdf_url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`
  });

  // 6. Notifier TD via WebSocket
  redis.publish(`user:${tdId}`, JSON.stringify({
    type: 'pdf_pret',
    dossier_id: dossierId,
    pdf_url: `/api/dossiers/${dossierId}/pdf/telecharger`
  }));
}
```

---

## 7. SYSTÈME DE NOTIFICATIONS PUSH

### 7.1 Déclencheurs et Payload

| Événement | Destinataire | Priorité | Déclencheur |
|-----------|-------------|---------|-------------|
| J-1 checklist | TD | Normal | Cron job 8h00 chaque matin |
| Rapport 😞 | TD | Haute | Soumission rapport avec 'mauvais' |
| Paiement effectué | Guide | Normal | POST /paiements |
| Nouveau message | TD / Guide | Normale | socket 'envoyer_message' |
| PDF prêt | TD | Faible | Worker PDF terminé |

### 7.2 Service Notifications

```javascript
// services/notificationService.js
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function envoyerPushNotification(userId, payload) {
  const user = await db('utilisateurs')
    .where('id', userId)
    .select('fcm_token')
    .first();

  if (!user?.fcm_token) return;

  const message = {
    token: user.fcm_token,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: payload.priority === 'high' ? 'high' : 'normal',
      notification: {
        sound: payload.android?.notification?.sound || 'default',
        channelId: payload.priority === 'high' ? 'alertes' : 'general'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: payload.apns?.payload?.aps?.sound || 'default',
          badge: payload.apns?.payload?.aps?.badge || 0
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    await db('notifications')
      .where('id', payload.notificationId)
      .update({ push_envoye: true, push_envoye_at: new Date() });
    return response;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      // Token invalide → nettoyer
      await db('utilisateurs').where('id', userId).update({ fcm_token: null });
    }
    throw err;
  }
}

// Cron J-1 : 8h00 chaque matin (node-cron)
cron.schedule('0 8 * * *', async () => {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateStr = demain.toISOString().split('T')[0];

  const dossiers = await db('dossiers')
    .where('date_debut', dateStr)
    .whereIn('statut', ['confirme', 'pret'])
    .join('utilisateurs as td', 'dossiers.td_id', 'td.id');

  for (const dossier of dossiers) {
    await envoyerPushNotification(dossier.td_id, {
      title: `Check-list J-1 — ${dossier.numero_dossier}`,
      body: `Groupe "${dossier.nom_groupe}" arrive demain. Validez la check-list.`,
      data: { type: 'checklist_j1', dossier_id: dossier.id },
      priority: 'normal'
    });
  }
});
```

### 7.3 Canaux Android (FCM)

```javascript
// À créer dans l'app mobile React Native au premier lancement
await messaging().createChannel({
  channelId: 'alertes',
  channelName: 'Alertes critiques',
  importance: AndroidImportance.HIGH,
  sound: 'alerte',
  vibration: true
});

await messaging().createChannel({
  channelId: 'general',
  channelName: 'Notifications générales',
  importance: AndroidImportance.DEFAULT
});
```

---

## 8. SÉCURITÉ & RBAC

### 8.1 Matrice des Permissions

| Ressource / Action | TD | Guide | Comptable | Admin |
|-------------------|:--:|:-----:|:---------:|:-----:|
| Créer dossier | ✅ | ❌ | ❌ | ✅ |
| Lire ses dossiers | ✅ | ✅* | ✅ | ✅ |
| Modifier dossier | ✅* | ❌ | ❌ | ✅ |
| Valider checklist | ✅* | ❌ | ❌ | ✅ |
| Soumettre rapport | ❌ | ✅* | ❌ | ✅ |
| Lire rapports | ✅* | ✅* | ❌ | ✅ |
| Effectuer paiement | ❌ | ❌ | ✅ | ✅ |
| Voir paiements | ❌ | ✅* | ✅ | ✅ |
| Évaluer guide | ✅* | ❌ | ❌ | ✅ |
| Lire évaluations | ✅ | ✅* | ❌ | ✅ |
| Générer PDF | ✅* | ❌ | ❌ | ✅ |
| Gérer utilisateurs | ❌ | ❌ | ❌ | ✅ |

`*` = uniquement les ressources liées à ses propres dossiers

### 8.2 Middleware Authentification & RBAC

```javascript
// middleware/auth.js
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token manquant' } });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token invalide ou expiré' } });
  }
};

const autoriser = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Rôle insuffisant' } });
  }
  next();
};

// Vérifier propriété du dossier (TD)
const verifierProprietaireDossier = async (req, res, next) => {
  const dossier = await db('dossiers').where('id', req.params.id).first();
  if (!dossier) return res.status(404).json({ error: { code: 'NOT_FOUND' } });

  const isTDProprietaire = dossier.td_id === req.user.id;
  const isGuideAssigne = dossier.guide_id === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isTDProprietaire && !isGuideAssigne && !isAdmin) {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  }

  req.dossier = dossier;
  next();
};

// Usage dans routes
router.patch('/dossiers/:id/checklist',
  authenticate,
  autoriser('TD', 'admin'),
  verifierProprietaireDossier,
  checklistController.valider
);
```

### 8.3 Sécurité Supplémentaire

```javascript
// Helmet (headers HTTP sécurisés)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.amazonaws.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: { code: 'RATE_LIMIT', message: 'Trop de requêtes' } }
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }); // Strict sur /auth/login

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);

// Validation entrées (Joi / Zod)
const schemaRapport = Joi.object({
  jour: Joi.number().integer().min(1).max(30).required(),
  date_rapport: Joi.date().iso().required(),
  petit_dejeuner: Joi.string().valid('bien', 'moyen', 'mauvais'),
  dejeuner: Joi.string().valid('bien', 'moyen', 'mauvais'),
  diner: Joi.string().valid('bien', 'moyen', 'mauvais'),
  hotel: Joi.string().valid('bien', 'moyen', 'mauvais'),
  transport: Joi.string().valid('bien', 'moyen', 'mauvais'),
  accueil_hote: Joi.string().valid('bien', 'moyen', 'mauvais'),
  commentaire: Joi.string().max(2000).allow('', null)
});

// Audit log automatique (middleware post-action)
const auditLogger = (action, entite) => async (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode < 400) {
      await db('audit_log').insert({
        user_id: req.user?.id,
        action,
        entite,
        entite_id: res.locals.entiteId,
        nouveau_val: res.locals.nouvelleValeur,
        ip_address: req.ip
      }).catch(console.error);
    }
  });
  next();
};

// Mots de passe : bcrypt cost factor 12
const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);
```

### 8.4 Variables d'Environnement Requises

```env
# Serveur
NODE_ENV=production
PORT=3000
API_URL=https://api.rihla.ma

# Auth
JWT_SECRET=<256-bit random secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# BDD
DATABASE_URL=postgresql://user:pass@host:5432/rihla

# Redis
REDIS_URL=redis://host:6379

# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-3
S3_BUCKET=rihla-files

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT=<base64 JSON>

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Email
SMTP_HOST=smtp.mailgun.org
SMTP_USER=...
SMTP_PASS=...
```

---

## 9. PLAN DE DÉVELOPPEMENT MVP

### Phase 1 — Fondations (Semaines 1-6)

**Semaine 1-2 : Setup & Auth**
- [ ] Initialisation repo monorepo (backend / web / mobile)
- [ ] Base de données PostgreSQL + migrations Knex/Prisma
- [ ] Authentification JWT + refresh tokens
- [ ] RBAC middleware (4 rôles)
- [ ] Tests unitaires auth (Jest)

**Semaine 3-4 : Dossiers & Programmes**
- [ ] CRUD Dossiers complet
- [ ] CRUD Programmes et items
- [ ] CRUD Prestataires
- [ ] Interface TD Web (React) : liste + détail dossiers
- [ ] Génération numéro dossier automatique

**Semaine 5-6 : Checklist & Notifications**
- [ ] Module checklist J-1
- [ ] Cron job notification J-1 (node-cron)
- [ ] Intégration Firebase FCM (mobile)
- [ ] Table notifications + API
- [ ] Tests E2E checklist (Cypress)

**Livrable Phase 1 :** TD peut créer/gérer un dossier complet, recevoir notification J-1

---

### Phase 2 — Temps Réel & Rapports (Semaines 7-10)

**Semaine 7-8 : App Mobile Guide + Rapports**
- [ ] App React Native : login, liste dossiers assignés
- [ ] Formulaire rapport journalier (émojis interactifs)
- [ ] POST /rapports avec validation
- [ ] Logique détection alerte 😞
- [ ] Alerte push < 3s (FCM high-priority)

**Semaine 9-10 : WebSocket Chat**
- [ ] Serveur Socket.io avec Redis adapter
- [ ] Rooms par dossier
- [ ] Chat TD ↔ Guide temps réel
- [ ] Dashboard TD : rapports en temps réel
- [ ] Indicateur "en ligne" guide

**Livrable Phase 2 :** Guide soumet rapports, TD reçoit alertes instantanées, chat fonctionnel

---

### Phase 3 — Paiements, PDF & IA (Semaines 11-14)

**Semaine 11-12 : Paiements & Évaluations**
- [ ] Interface comptable : effectuer virement
- [ ] Traçabilité complète (référence + statut)
- [ ] Notification guide après paiement
- [ ] Formulaire évaluation TD (note /10 + critique)
- [ ] Intégration Claude API (génération brouillon évaluation)
- [ ] Historique évaluations dans profil guide

**Semaine 13-14 : PDF & Finalisation**
- [ ] Worker PDF (Puppeteer + Handlebars)
- [ ] Template PDF dossier guide complet
- [ ] Upload S3 + URL signée
- [ ] Audit log complet
- [ ] Tableau de bord global (statistiques tours, guides, alertes)
- [ ] Tests de charge (k6) — objectif: 100 utilisateurs simultanés
- [ ] Documentation API (Swagger/OpenAPI)

**Livrable Phase 3 :** Plateforme complète, prête pour beta utilisateurs

---

### Résumé Planning

```
Semaines  1  2  3  4  5  6  7  8  9 10 11 12 13 14
          ─────────────────────────────────────────
Phase 1   ████████████████████
Phase 2                       ████████████
Phase 3                                   ████████████
```

### Métriques de Succès MVP

| Métrique | Objectif |
|---------|---------|
| Latence alerte 😞 | < 3 secondes |
| Disponibilité API | > 99.5% |
| Temps génération PDF | < 30 secondes |
| Support utilisateurs simultanés | 100+ |
| Couverture tests | > 80% |
| Score Lighthouse app mobile | > 85 |

---

*Document généré le 25 avril 2026 — RIHLA v1.0*
