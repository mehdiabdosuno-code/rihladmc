# RIHLA — Refonte visuelle marocaine & touristique

Branche : **`feature/moroccan-design`** (1 commit sur `feature/erp-modules`).

Cette refonte repose sur le logo officiel **RIHLA Tourist Platform** (terracotta `#B43E20` + calligraphie crème) et s'inspire de l'artisanat marocain : zellige, arches mauresques, tapis berbère.

![Aperçu login](./login_preview.png)

## 1. Palette

| Token Tailwind | Hex     | Utilisation |
|----------------|---------|-------------|
| `rihla`        | `#B43E20` | Couleur principale (boutons, headings accent) |
| `rihla-dark`   | `#8A2D17` | Hover CTA |
| `sahara`       | `#D4A574` | Or désert — accents, eyebrows |
| `majorelle`    | `#2C4A7C` | Bleu Majorelle — accents secondaires |
| `atlas`        | `#3A7D5C` | Vert thé — status "live" |
| `zellige`      | `#0E6E6E` | Turquoise des carreaux de Fès |
| `ink`          | `#1A1614` | Fond sombre (charbon chaud) |
| `cream`        | `#F5E6D3` | Texte crème / fond clair |
| `ivory`        | `#FBF4E5` | Fond ivoire — app |

## 2. Utilitaires CSS (index.css)

- `.berber-rule` — liséré horizontal multicolore (terracotta / sahara / majorelle)
- `.diamond-rule` — divider centré avec diamants or
- `.bg-zellige-star` — tessellation d'étoiles à 8 branches en fond
- `.bg-zellige-star-cream` — variante crème pour fonds sombres
- `.arch-top` — arche mauresque en haut d'un conteneur
- `.card-moroccan` — variante de carte avec bordure ornée
- `.hero-moroccan` — bandeau d'accueil avec glows + pattern
- `.eyebrow-moroccan` — petit texte titre avec diamant de tête

## 3. Composants réutilisables

`src/components/visuals/Moroccan.tsx` — exporte :

| Composant           | Description |
|---------------------|-------------|
| `<ZelligePattern/>` | Tessellation SVG (variantes `star` / `lattice` / `kasbah`) avec couleur et opacité paramétrables |
| `<MoroccanArch/>`   | Arche mauresque décorative (remplie ou en contour) |
| `<BerberRule/>`     | Liséré de tapis berbère |
| `<DiamondRule/>`    | Divider orné de diamants |
| `<StarBadge/>`      | Pastille étoile à 8 branches |
| `<MoroccanHero/>`   | Hero prêt-à-l'emploi avec eyebrow / titre / sous-titre |

## 4. Pages refondues

- **LoginPage** : gauche éditorial noir charbon + zellige crème, logo RIHLA + tagline « L'âme du Maroc, orchestrée par la tech. », grille de features (Cotation / Itinéraire / Carnet). Droite formulaire sur ivoire avec arche mauresque au-dessus du titre, berber rule, diamond rule « STOURS VOYAGES ».
- **AppShell (sidebar)** : tessellation zellige en fond opacité 5%, pastille logo cerclée or sahara, berber rule sous le titre.
- **DashboardPage (header)** : hero ivoire dégradé avec zellige kasbah, glows terracotta + sahara, berber rule bas.
- **Favicon + manifest PWA** : logo mark (`rihla-logo-mark.png`), couleur thème `#B43E20`.

## 5. Compatibilité

- Tous les composants existants continuent de fonctionner (aucun breaking change).
- Les couleurs `rihla`, `cream`, `ink`, `sand`, `saffron` sont légèrement retintées mais conservent leur sémantique.
- Le build Vite passe (`vite build` → `✓ built in 7.40s`).

## 6. Comment appliquer

```bash
# Depuis la racine du projet RIHLA
cd /chemin/vers/RIHLA
git apply PATCH.diff

# Ou copier manuellement les fichiers du dossier frontend/ de ce ZIP
# par-dessus votre arborescence.

cd frontend
pnpm install   # (rien de nouveau mais refresh du lockfile si besoin)
pnpm dev       # prévisualiser
```

## 7. Fichiers modifiés

| Chemin | Type |
|--------|------|
| `frontend/tailwind.config.js` | modifié — palette + backgroundImage |
| `frontend/src/index.css` | modifié — tokens CSS + utilitaires marocains |
| `frontend/src/components/visuals/Moroccan.tsx` | nouveau — primitives marocaines |
| `frontend/src/pages/LoginPage.tsx` | modifié — refonte complète |
| `frontend/src/components/layout/AppShell.tsx` | modifié — sidebar zellige + fix dupli unreadCount |
| `frontend/src/pages/DashboardPage.tsx` | modifié — hero marocain |
| `frontend/public/manifest.json` | modifié — marque + couleur |
| `frontend/public/rihla-logo.png` | nouveau — logo full |
| `frontend/public/rihla-logo-mark.png` | nouveau — pastille ronde |
| `frontend/index.html` | modifié — favicon + meta |
