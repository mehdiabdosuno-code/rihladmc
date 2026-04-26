-- ============================================================
-- RIHLA — Migration 001 : Schéma initial complet
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés
CREATE TYPE role_utilisateur  AS ENUM ('TD', 'guide', 'comptable', 'client', 'admin');
CREATE TYPE statut_dossier    AS ENUM ('brouillon', 'confirme', 'pret', 'en_cours', 'termine', 'archive');
CREATE TYPE type_prestataire  AS ENUM ('hotel', 'restaurant', 'activite', 'transport', 'autre');
CREATE TYPE emoji_evaluation  AS ENUM ('bien', 'moyen', 'mauvais');
CREATE TYPE statut_paiement   AS ENUM ('en_attente', 'effectue', 'confirme', 'rejete');
CREATE TYPE type_notification AS ENUM ('checklist_j1', 'alerte_rapport', 'paiement', 'message', 'evaluation');

-- ---- utilisateurs ----
CREATE TABLE utilisateurs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom               VARCHAR(100) NOT NULL,
    prenom            VARCHAR(100) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe      VARCHAR(255) NOT NULL,
    role              role_utilisateur NOT NULL,
    telephone         VARCHAR(20),
    photo_url         TEXT,
    fcm_token         TEXT,
    actif             BOOLEAN DEFAULT TRUE,
    derniere_connexion TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role  ON utilisateurs(role);

-- ---- refresh_tokens ----
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoque    BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ---- prestataires ----
CREATE TABLE prestataires (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom               VARCHAR(200) NOT NULL,
    type              type_prestataire NOT NULL,
    ville             VARCHAR(100),
    adresse           TEXT,
    telephone         VARCHAR(20),
    telephone_urgence VARCHAR(20),
    email             VARCHAR(255),
    notes             TEXT,
    actif             BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prestataires_type  ON prestataires(type);
CREATE INDEX idx_prestataires_ville ON prestataires(ville);

-- ---- dossiers ----
CREATE SEQUENCE seq_numero_dossier START 1;

CREATE TABLE dossiers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_dossier   VARCHAR(50) NOT NULL UNIQUE,
    nom_groupe       VARCHAR(200) NOT NULL,
    date_debut       DATE NOT NULL,
    date_fin         DATE NOT NULL,
    statut           statut_dossier NOT NULL DEFAULT 'brouillon',
    td_id            UUID NOT NULL REFERENCES utilisateurs(id),
    guide_id         UUID REFERENCES utilisateurs(id),
    nb_participants  INTEGER DEFAULT 0,
    notes_internes   TEXT,
    pdf_url          TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_dates CHECK (date_fin >= date_debut)
);
CREATE INDEX idx_dossiers_td     ON dossiers(td_id);
CREATE INDEX idx_dossiers_guide  ON dossiers(guide_id);
CREATE INDEX idx_dossiers_statut ON dossiers(statut);
CREATE INDEX idx_dossiers_dates  ON dossiers(date_debut, date_fin);

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

-- ---- programmes ----
CREATE TABLE programmes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id  UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    jour        INTEGER NOT NULL,
    date        DATE NOT NULL,
    titre       VARCHAR(200),
    description TEXT,
    ordre       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dossier_id, jour)
);
CREATE INDEX idx_programmes_dossier ON programmes(dossier_id);

-- ---- programme_items ----
CREATE TABLE programme_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id    UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    type            type_prestataire NOT NULL,
    prestataire_id  UUID REFERENCES prestataires(id),
    prestataire_nom VARCHAR(200),
    heure_debut     TIME,
    heure_fin       TIME,
    lieu            VARCHAR(200),
    notes           TEXT,
    ordre           INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_programme_items_programme ON programme_items(programme_id);
CREATE INDEX idx_programme_items_dossier   ON programme_items(dossier_id);

-- ---- checklist_24h ----
CREATE TABLE checklist_24h (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id           UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE UNIQUE,
    appel_restaurants    BOOLEAN DEFAULT FALSE,
    appel_hotels         BOOLEAN DEFAULT FALSE,
    appel_activites      BOOLEAN DEFAULT FALSE,
    dossier_guide_pret   BOOLEAN DEFAULT FALSE,
    valide_par           UUID REFERENCES utilisateurs(id),
    valide_at            TIMESTAMPTZ,
    notes                TEXT,
    notification_envoyee BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

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

-- ---- rapports_journaliers ----
CREATE TABLE rapports_journaliers (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id         UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    guide_id           UUID NOT NULL REFERENCES utilisateurs(id),
    jour               INTEGER NOT NULL,
    date_rapport       DATE NOT NULL,
    petit_dejeuner     emoji_evaluation,
    dejeuner           emoji_evaluation,
    diner              emoji_evaluation,
    hotel              emoji_evaluation,
    transport          emoji_evaluation,
    accueil_hote       emoji_evaluation,
    commentaire        TEXT,
    alerte_envoyee     BOOLEAN DEFAULT FALSE,
    categories_alertes TEXT[],
    soumis_at          TIMESTAMPTZ DEFAULT NOW(),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dossier_id, jour)
);
CREATE INDEX idx_rapports_dossier ON rapports_journaliers(dossier_id);
CREATE INDEX idx_rapports_guide   ON rapports_journaliers(guide_id);

-- ---- paiements_guides ----
-- NOTE : Traçabilité virements bancaires uniquement.
-- Les bons physiques espèces terrain sont hors BDD (règle métier stricte).
CREATE TABLE paiements_guides (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id         UUID NOT NULL REFERENCES dossiers(id),
    guide_id           UUID NOT NULL REFERENCES utilisateurs(id),
    montant            DECIMAL(10,2) NOT NULL,
    devise             VARCHAR(3) DEFAULT 'MAD',
    reference_bancaire VARCHAR(100) UNIQUE,
    statut             statut_paiement NOT NULL DEFAULT 'en_attente',
    effectue_par       UUID NOT NULL REFERENCES utilisateurs(id),
    note               TEXT,
    confirme_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_montant CHECK (montant > 0)
);
CREATE INDEX idx_paiements_dossier ON paiements_guides(dossier_id);
CREATE INDEX idx_paiements_guide   ON paiements_guides(guide_id);
CREATE INDEX idx_paiements_statut  ON paiements_guides(statut);

-- ---- evaluations_guides ----
CREATE TABLE evaluations_guides (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id  UUID NOT NULL REFERENCES dossiers(id),
    guide_id    UUID NOT NULL REFERENCES utilisateurs(id),
    td_id       UUID NOT NULL REFERENCES utilisateurs(id),
    note        DECIMAL(3,1) NOT NULL,
    critique    TEXT NOT NULL,
    source_aide VARCHAR(50),
    brouillon   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dossier_id, guide_id),
    CONSTRAINT chk_note CHECK (note >= 0 AND note <= 10)
);
CREATE INDEX idx_evaluations_guide ON evaluations_guides(guide_id);

-- ---- messages ----
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id      UUID NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    expediteur_id   UUID NOT NULL REFERENCES utilisateurs(id),
    destinataire_id UUID NOT NULL REFERENCES utilisateurs(id),
    contenu         TEXT NOT NULL,
    lu              BOOLEAN DEFAULT FALSE,
    lu_at           TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_dossier      ON messages(dossier_id);
CREATE INDEX idx_messages_participants ON messages(expediteur_id, destinataire_id);
CREATE INDEX idx_messages_non_lus      ON messages(destinataire_id, lu) WHERE lu = FALSE;

-- ---- notifications ----
CREATE TABLE notifications (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type           type_notification NOT NULL,
    titre          VARCHAR(255) NOT NULL,
    corps          TEXT,
    dossier_id     UUID REFERENCES dossiers(id),
    rapport_id     UUID REFERENCES rapports_journaliers(id),
    lu             BOOLEAN DEFAULT FALSE,
    lu_at          TIMESTAMPTZ,
    push_envoye    BOOLEAN DEFAULT FALSE,
    push_envoye_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, lu);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ---- audit_log ----
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES utilisateurs(id),
    action      VARCHAR(100) NOT NULL,
    entite      VARCHAR(50),
    entite_id   UUID,
    ancien_val  JSONB,
    nouveau_val JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user   ON audit_log(user_id);
CREATE INDEX idx_audit_entite ON audit_log(entite, entite_id);
CREATE INDEX idx_audit_date   ON audit_log(created_at);

-- ---- Trigger updated_at universel ----
CREATE OR REPLACE FUNCTION maj_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_utilisateurs
    BEFORE UPDATE ON utilisateurs FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_dossiers
    BEFORE UPDATE ON dossiers FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_programmes
    BEFORE UPDATE ON programmes FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_checklist_24h
    BEFORE UPDATE ON checklist_24h FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_paiements_guides
    BEFORE UPDATE ON paiements_guides FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_evaluations_guides
    BEFORE UPDATE ON evaluations_guides FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
CREATE TRIGGER trg_updated_prestataires
    BEFORE UPDATE ON prestataires FOR EACH ROW EXECUTE FUNCTION maj_updated_at();
