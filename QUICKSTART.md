# RIHLA — Quick Start

> **Démarrage en 2 minutes** avec Docker.

## Prérequis

- Docker + Docker Compose v2 (`docker compose version` doit afficher `v2.x`)
- 2 Go RAM libres
- Port 5173 et 8000 libres (dev) ou port 80 (prod)

---

## 🚀 Mode développement (recommandé pour tester)

```bash
# 1. Cloner le projet
git clone <URL_REPO> rihla
cd rihla

# 2. (Optionnel) ajouter votre clé Anthropic API
echo "ANTHROPIC_API_KEY=sk-ant-api03-votre-clé" > .env

# 3. Lancer la stack
docker compose up
```

**C'est tout.** Attendez 1–2 minutes que la DB soit prête, puis ouvrez :

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 (user: `rihla`, db: `rihla_db`) |

### Connexion

```
Email :     a.chakir@stours.ma
Password :  Abdo@1937
```

### Arrêt

```bash
docker compose down           # arrête sans supprimer les données
docker compose down -v        # arrête ET efface la base de données
```

---

## 🏭 Mode production

### 1. Configuration

```bash
# Copier le template et le remplir
cp .env.example .env
nano .env
```

Variables **obligatoires** à remplir :

- `POSTGRES_PASSWORD` — mot de passe PostgreSQL fort
- `REDIS_PASSWORD` — mot de passe Redis fort
- `SECRET_KEY` — générer avec `openssl rand -hex 32`
- `JWT_SECRET_KEY` — générer avec `openssl rand -hex 32`
- `ANTHROPIC_API_KEY` — votre clé Anthropic
- `ADMIN_PASSWORD` — mot de passe admin initial
- `CORS_ORIGINS` — vos domaines (ex: `https://rihla.stours.ma`)

### 2. Lancement

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Vérifier que tout est UP :

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

L'application est accessible sur **http://VOTRE_SERVEUR** (port 80).

### 3. HTTPS

Pour activer HTTPS :
1. Obtenez un certificat SSL (Let's Encrypt recommandé)
2. Montez-le dans `frontend/nginx.conf`
3. Décommentez la ligne `- "443:443"` dans `docker-compose.prod.yml`

---

## 🛠 Opérations courantes

```bash
# Voir les logs
docker compose logs -f api
docker compose logs -f frontend

# Entrer dans le conteneur API
docker compose exec api bash

# Re-seeder la base
docker compose exec api python /scripts/seed_data.py

# Backup PostgreSQL
docker compose exec db pg_dump -U rihla rihla_db > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker compose exec -T db psql -U rihla rihla_db

# Reconstruire après changement de code
docker compose build api
docker compose up -d api
```

---

## 🐛 Résolution de problèmes

### Le frontend ne se connecte pas à l'API

Vérifiez que le backend est bien UP :
```bash
curl http://localhost:8000/api/health
```

### "Port already in use"

Un autre service utilise 5173 ou 8000. Tuez-le ou changez les ports dans `docker-compose.yml`.

### "database rihla_db does not exist"

Supprimez le volume et recommencez :
```bash
docker compose down -v
docker compose up
```

### Erreur Anthropic AI

Sans clé Anthropic, le moteur IA est désactivé mais le reste marche. Pour l'activer, ajoutez votre clé dans `.env`.

---

## 📞 Support

**CHAKIR Abdelwahed**
a.chakir@stours.ma
+212 522 95 40 00
