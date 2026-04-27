# ERP Integration — SAP S/4HANA Cloud & SAP Business One

> Phase 1 — push factures RIHLA → ERP du client final (testable end-to-end via mode `dry-run`).

---

## 1. Pourquoi cette intégration

Beaucoup de clients corporate de RIHLA exigent que les factures fournisseurs
arrivent directement dans leur ERP (SAP S/4HANA Cloud ou SAP Business One)
plutôt qu'en PDF par e-mail. Cette intégration :

- supprime la double saisie côté client → réduit le DSO de 10-15 jours en moyenne ;
- aligne RIHLA sur la promesse "SAP-ready" attendue dans les RFP corporate ;
- ouvre la voie aux pistes complémentaires Concur App Center (Piste 1) et
  Ariba Network (Piste 3) couvertes dans `rihla_sap_integration.md`.

---

## 2. Architecture

```
┌────────────────────────┐    POST /api/erp/invoices/{id}/push
│  Frontend  InvoicePage │ ──────────────────────────────────►  ┌─────────────────────────┐
│  + ErpIntegrationsPage │                                       │ erp_integration.router  │
└────────────────────────┘                                       └────────────┬────────────┘
                                                                             ▼
                                          ┌──────────────────────────────────────────────────┐
                                          │ service.push_invoice(db, company, invoice, …)    │
                                          │  1. resolve_config(company, invoice)             │
                                          │  2. compute_idempotency_key(invoice, cfg)        │
                                          │  3. existing log lookup → return early if exists │
                                          │  4. mapper(invoice, cfg.mapping) → SAP payload   │
                                          │  5. dry_run? → mock 200 + DRY-… ref              │
                                          │     else    → clients.{s4hana|business_one}      │
                                          │  6. persist ErpPushLog (audit + idempotence)     │
                                          └──────────────────────────────────────────────────┘
```

Tables :
- `erp_client_configs`  : 1 ligne / (Company, Client) — credentials + base_url + mapping JSON
- `erp_push_logs`       : 1 ligne / push (statut, http_status, remote_ref, payload, durée)

Idempotence :
`sha256(invoice.id | invoice.updated_at | cfg.id | cfg.updated_at)` →
si rien n'a bougé, le second push retourne le log existant.

---

## 3. Onboarding d'un nouveau client

### 3.1 Configuration commune

Pour les deux ERP :

| champ          | description                                          | exemple                                   |
| -------------- | ---------------------------------------------------- | ----------------------------------------- |
| `client_key`   | slug stable (à matcher sur `invoice.client_email`)   | `acme-fr@acme.com`                        |
| `label`        | libellé humain                                       | `ACME France · S/4HANA Prod`              |
| `kind`         | `sap_s4hana` ou `sap_business_one`                   | `sap_s4hana`                              |
| `base_url`     | URL racine du tenant                                 | `https://my-acme.s4hana.cloud.sap`        |
| `is_dry_run`   | `true` = aucune requête sortante (mock, mais audité) | `true` au démarrage                       |
| `is_active`    | `false` pour désactiver sans supprimer               | `true`                                    |
| `mapping`      | JSON optionnel (overrides du mapper)                 | `{"company_code":"1010","gl_account":"…"}`|

### 3.2 SAP S/4HANA Cloud

Auth : OAuth2 Client Credentials.

| champ                  | description                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `oauth_token_url`      | `https://<tenant>.authentication.eu10.hana.ondemand.com/oauth/token`             |
| `oauth_client_id`      | obtenu dans BTP Cockpit → Service Instance → Service Key                         |
| `oauth_client_secret`  | idem (stocké chiffré côté DB)                                                    |
| `oauth_scope`          | optionnel (laisser vide la première fois)                                        |
| `base_url`             | endpoint OData racine (sans trailing `/sap/opu/odata/sap/...`)                   |

Côté SAP S/4HANA Cloud :
1. **Communication System** dédié à RIHLA (ID `RIHLA_OUT`).
2. **Communication User** : type `OAuth 2.0` → fournit client_id + client_secret.
3. **Communication Arrangement** : scenario `SAP_COM_0057` (Supplier Invoice Integration).
4. Vérifier l'accès au service `API_SUPPLIERINVOICE_PROCESS_SRV`.

L'API utilisée par le client RIHLA :
`POST {base_url}/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice`.

### 3.3 SAP Business One

Auth : Service Layer (session-based).

| champ           | description                                           |
| --------------- | ----------------------------------------------------- |
| `b1_company_db` | nom de la base SAP B1 (`SBODEMOFR`, `MyCompany`, …)   |
| `b1_username`   | utilisateur SAP B1 dédié à l'intégration              |
| `b1_password`   | mot de passe (stocké chiffré)                         |
| `base_url`      | URL Service Layer (`https://hana-host:50000/b1s/v1`)  |

Côté Business One :
1. Créer un **utilisateur SAP** dédié (`RIHLA_API`) avec licence `Indirect Access`.
2. Donner les autorisations : Sales A/R → A/R Invoice (read+write), BP read.
3. Ouvrir le port 50000 (Service Layer) depuis l'IP de RIHLA.

L'API utilisée :
- `POST {base_url}/Login` → cookie de session `B1SESSION` + `ROUTEID` (cache mémoire 25 min).
- `POST {base_url}/Invoices` (ou `/PurchaseInvoices` selon le mapping).

### 3.4 Mode `dry-run` (recommandé pour démarrer)

Cocher `is_dry_run=true`. Aucun appel réseau n'est émis. Le payload est calculé,
loggué intégralement dans `erp_push_logs.request_payload`, et un faux statut
`200` + `remote_ref=DRY-{idem[:12]}` est renvoyé.

C'est exactement le même chemin de code que la prod (mapper + idempotency +
log) **sauf** la dispatchition réseau. Ça permet :
- tester l'onboarding sans provisionner de tenant SAP (quand le client dit
  "on regardera l'an prochain") ;
- valider le mapping (le client peut copier le `request_payload` dans son ERP
  manuellement pour vérifier le rendu) ;
- éviter qu'une mauvaise config rejette des factures réelles.

---

## 4. Mapping facture RIHLA → SAP

### 4.1 Pour S/4HANA (`A_SupplierInvoice`)

| champ SAP                  | source RIHLA                                                  | override possible          |
| -------------------------- | ------------------------------------------------------------- | -------------------------- |
| `CompanyCode`              | `mapping.company_code` (par défaut `"1010"`)                  | oui                        |
| `DocumentDate`             | `invoice.issue_date`                                          | non                        |
| `PostingDate`              | `invoice.issue_date`                                          | non                        |
| `InvoicingParty`           | `mapping.supplier_id` (RIHLA SIRET)                           | oui                        |
| `DocumentCurrency`         | `invoice.currency`                                            | non                        |
| `InvoiceGrossAmount`       | `invoice.total`                                               | non                        |
| `SupplierInvoiceIDByInvcgParty` | `invoice.number`                                         | non                        |
| `to_SupplierInvoiceItemPurOrdAcct` | une ligne par `invoice.lines` (ou agrégé si vide)     | partiellement              |

Une ligne d'item :

| champ SAP                          | source RIHLA                            |
| ---------------------------------- | --------------------------------------- |
| `SupplierInvoiceItem`              | index 1..N                              |
| `PurchaseOrderQuantityUnit`        | `mapping.quantity_unit` (`"EA"`)        |
| `QuantityInPurchaseOrderUnit`      | `line.qty` ou `1.0`                     |
| `TaxCode`                          | `mapping.tax_code` (`"V0"`)             |
| `GLAccount`                        | `mapping.gl_account` (`"0000400000"`)   |
| `CostCenter`                       | `mapping.cost_center`                   |
| `SupplierInvoiceItemText`          | `line.description` ou `invoice.number`  |

### 4.2 Pour Business One (`/Invoices`)

| champ SAP B1     | source RIHLA                          |
| ---------------- | ------------------------------------- |
| `CardCode`       | `mapping.card_code` (`"C00001"`)      |
| `DocDate`        | `invoice.issue_date`                  |
| `DocDueDate`     | `invoice.due_date` ou `issue_date`    |
| `DocCurrency`    | `invoice.currency`                    |
| `Comments`       | `invoice.number`                      |
| `DocumentLines`  | une ligne par `invoice.lines`         |

Une ligne :

| champ SAP B1     | source RIHLA                                |
| ---------------- | ------------------------------------------- |
| `ItemCode`       | `mapping.default_item_code` (`"SVC001"`)    |
| `ItemDescription`| `line.description` ou `invoice.number`      |
| `Quantity`       | `line.qty` ou `1`                           |
| `UnitPrice`      | `line.unit_price` ou `invoice.subtotal`     |
| `TaxCode`        | `mapping.tax_code` (`"EXEMPT"`)             |

### 4.3 Personnaliser via `mapping` JSON

Exemple complet pour un client S/4HANA :

```json
{
  "company_code": "FR01",
  "supplier_id":  "0000123456",
  "tax_code":     "V1",
  "gl_account":   "0000610000",
  "cost_center":  "FR01-MICE",
  "quantity_unit":"EA"
}
```

Toute clé non fournie tombe sur les defaults définis dans `mappers.py`.

---

## 5. API HTTP

Tous les endpoints sont sous `/api/erp` et requièrent l'auth standard
RIHLA (header `Authorization: Bearer …`). La création/modif/suppression d'une
config est réservée aux rôles admin (`super_admin`, `quotation_officer`).

| méthode | path                                  | description                                             |
| ------- | ------------------------------------- | ------------------------------------------------------- |
| `GET`   | `/api/erp/configs`                    | liste des configs de la company de l'utilisateur        |
| `POST`  | `/api/erp/configs`                    | crée une config (admin)                                 |
| `PATCH` | `/api/erp/configs/{cfg_id}`           | mise à jour partielle (admin)                           |
| `DELETE`| `/api/erp/configs/{cfg_id}`           | suppression (admin)                                     |
| `POST`  | `/api/erp/invoices/{invoice_id}/push` | déclenche un push (idempotent par défaut)               |
| `GET`   | `/api/erp/logs?invoice_id&status&…`   | historique d'audit                                      |
| `GET`   | `/api/erp/logs/{log_id}`              | détail d'un push                                        |

Body de `POST /api/erp/invoices/{id}/push` :

```json
{
  "config_id": "<uuid>",   // optionnel — auto-resolu si absent
  "force": false           // true = retry après échec (même clé d'idempotence)
}
```

Réponse :

```json
{
  "log_id":          "<uuid>",
  "status":          "success",
  "http_status":     200,
  "remote_ref":      "DRY-c24362c153c9",
  "is_dry_run":      true,
  "duration_ms":     0,
  "error_message":   null,
  "request_payload": { ... payload SAP complet ... }
}
```

Les champs sensibles (`oauth_client_secret`, `b1_password`) ne sont **jamais**
retournés. Seules les booléens `has_oauth_secret` / `has_b1_password` indiquent
leur présence.

---

## 6. Front-end

- `/erp-integrations` (admin) — liste + CRUD des configs (modale dédiée).
  Sensible à `is_dry_run` (badge orange) et `is_active` (badge gris).
- Sur `/invoices`, chaque ligne reçoit un bouton **"ERP"** (à côté de "PDF")
  qui ouvre une modale : sélection de la config cible, option `force`,
  bouton "Envoyer vers l'ERP", + historique des derniers pushes pour cette
  facture (statut OK/KO, durée, ref, message d'erreur).
- Les types TS sont exportés depuis `frontend/src/lib/api.ts` :
  `ErpConfig`, `ErpConfigPayload`, `ErpPushResult`, `ErpPushLog`.

---

## 7. Procédure de test (dry-run)

1. Connexion en `super_admin`.
2. Aller sur **ERP Client (SAP)** dans la sidebar (groupe "GESTION & FINANCE").
3. Cliquer "Nouvelle configuration" :
   - `client_key` = `client@acme.com`
   - `label`      = `ACME · Test`
   - `kind`       = `sap_s4hana`
   - `is_dry_run` = ✓
4. Aller sur **Facturation**, sélectionner une facture dont
   `client_email = client@acme.com`.
5. Cliquer **ERP** → la modale s'ouvre, choisir la config (ou laisser "Auto"),
   cliquer **Envoyer vers l'ERP**.
6. Résultat attendu :
   - bandeau vert "Push réussi" + badge "Dry-run".
   - `HTTP 200`, `remote_ref` = `DRY-…`.
   - Historique : 1 ligne `OK [dry-run] sap_s4hana`.
7. Re-cliquer **Envoyer** → la même réponse est retournée (idempotence)
   sans nouveau log.
8. Cocher **Forcer le re-push** → si le push initial a échoué, une nouvelle
   tentative est faite (même clé, ligne d'audit remplacée). Si le push avait
   réussi, le résultat précédent est retourné inchangé (sécurité).

---

## 8. Passage en production réelle

1. Renseigner les credentials (OAuth2 ou Service Layer).
2. Décocher `is_dry_run`.
3. Faire un premier push manuel sur une facture **draft** dans un tenant SAP
   sandbox du client. Vérifier l'arrivée du document.
4. Une fois validé, le push est déclenché manuellement par les TD/finance
   depuis la page Facturation. Une automatisation cron (à la transition
   `issued → sent`) est prévue en Phase 2.

### Sécurité

- `oauth_client_secret` et `b1_password` sont stockés en clair dans la DB pour
  la Phase 1 → **migration vers SecretsManager / KMS prévue Phase 2** avant
  toute mise en production live.
- Les payloads sont tronqués au-delà de 8 ko (`response_payload`) pour éviter
  de saturer la table d'audit.
- Le token OAuth2 et les cookies B1 sont mis en cache mémoire au niveau
  process (clé : `cfg.id`). Pas de sérialisation disque.

---

## 9. Roadmap

| Phase | Contenu                                                                  | Effort     |
| ----- | ------------------------------------------------------------------------ | ---------- |
| **1** (PR) | Foundation backend + UI minimale + dry_run + idempotence + audit    | ~4 j-dev   |
| 2     | Stockage credentials chiffré, cron auto-push, retry exponentiel,         | ~6 j-dev   |
|       | tests d'intégration sur SAP Cloud Trial                                  |            |
| 3     | Mapping bidirectionnel (statut paiement SAP → invoice.status RIHLA)      | ~5 j-dev   |
| 4     | Branchement Concur Expense (Piste 1) + Ariba Network (Piste 3)           | ~7 j-dev   |

Total ≈ **22 j-dev** comme annoncé dans `rihla_sap_integration.md`.
