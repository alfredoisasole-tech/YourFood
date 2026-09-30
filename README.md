# 🍽️ Your Food (meal-app) — Application d'abonnement de repas

Application web permettant à des clients abonnés de commander chaque jour un repas parmi les options du menu, préparé et livré par une administratrice de restauration à Kinshasa. L'administratrice inscrit les clients, publie les menus et suit la préparation ; les clients choisissent leur repas depuis leur téléphone.

L'interface reprend la direction artistique de la maquette (`Maquette/`) : typographies DM Sans et Instrument Serif, vert `#1F7A4D`, fond crème, cartes arrondies, mode sombre à accent orange.

---

## Fonctionnalités

**Espace client** (pensé pour le téléphone)
- Bienvenue, connexion (« Prénom Nom » + mot de passe), première connexion en deux étapes avec le code reçu
- Accès direct par lien ou QR code : le code et le nom sont dans la partie après `#` du lien
- Menu du jour en paquet de cartes (Plat, Accompagnement, Viande), compte à rebours, états normal · en retard · verrouillé · attribué par défaut · annulé · abonnement expiré
- Annulation possible même sans avoir commandé, réversible jusqu'à 20h00
- Avis facultatif sur le repas précédent ; historique avec recherche par plat, filtre par dates et notation a posteriori
- Compte : mode sombre, changement de mot de passe, déconnexion

**Espace administratrice** (onglets en bas sur téléphone, barre latérale sur ordinateur)
- Accueil : menu de demain, semaine de livraison, livraisons du jour
- Suivi du jour en direct (actualisé toutes les 15 s), case « préparé », heure limite réglable, liste finale après 20h00
- Clients : inscription (téléphone facultatif, début un lundi, total calculé), code + lien + QR + message WhatsApp, fiche avec renouvellement, modification, réinitialisation du mot de passe
- Carte des plats, publication des menus (un jour ou plusieurs), avis, statistiques

**Règles métier** : voir [`SPEC.md`](./SPEC.md) (v3.1). Verrouillage automatique à 20h00 (heure de Kinshasa) avec attribution du repas le plus demandé aux clients qui n'ont ni choisi ni annulé.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 19 + React Router 7 + Tailwind CSS 3 + Vite |
| Backend | Node.js / Express + helmet |
| Base de données | PostgreSQL + Prisma (ORM) |
| Authentification | JWT (invalidé à chaque changement de mot de passe) + bcrypt |
| Validation | zod, schémas partagés dans `packages/shared` |
| Dates | dayjs + règles de calendrier partagées (fuseau Africa/Kinshasa) |
| QR code | qrcode |
| Sécurité | express-rate-limit (par adresse IP et par compte) |

**Organisation** : monorepo avec workspaces npm. Architecture simple — un seul serveur, une seule base, pas de microservices, pas de cache, pas de file de messages.

---

## Installation locale

### Prérequis

- Node.js ≥ 20
- Docker Desktop (pour PostgreSQL) ou un PostgreSQL ≥ 15
- npm ≥ 9

### Étapes

```bash
# 1. Installer les dépendances (monorepo)
npm install

# 2. Démarrer PostgreSQL
docker compose up -d
#    Si le port 5432 est déjà pris par un PostgreSQL installé sur la machine :
#    créer un fichier .env à la racine contenant POSTGRES_PORT=55432, puis relancer.

# 3. Configurer le backend
cp .env.example apps/backend/.env
#    Éditer apps/backend/.env : DATABASE_URL (avec le bon port), JWT_SECRET (long et aléatoire)

# 4. Générer le client Prisma et appliquer les migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Données de démonstration (optionnel, voir TEST_DATA.md)
npm run prisma:seed --workspace=apps/backend

# 6. Démarrer le backend puis le frontend (deux terminaux)
npm run dev:backend
npm run dev:frontend
```

Ouvrir http://localhost:5173 (espace client) ou http://localhost:5173/admin (administratrice). En développement, Vite relaie `/api` vers le backend sur le port 3001.

### Comptes de démonstration

| Rôle | Identifiant | Accès |
|---|---|---|
| Administratrice | `Sarah BOKETSU` | mot de passe `Admin@2026!` |
| Client | `Patrick KABAMBA` | première connexion avec le code `KP7X8A9B` |

Les autres comptes et scénarios sont décrits dans [`TEST_DATA.md`](./TEST_DATA.md).

### Tests

```bash
npm run typecheck
npm run lint
npm test

# Tests d'intégration sur une vraie base (base dédiée, vidée à chaque test) :
TEST_DATABASE_URL="postgresql://user:password@localhost:55432/mealapp_test?schema=public" \
  npm run test --workspace=apps/backend
```

La base de test se crée une fois avec `CREATE DATABASE mealapp_test;` puis `DATABASE_URL=<même adresse> npx prisma migrate deploy` dans `apps/backend`. La CI lance ces tests automatiquement.

---

## Mise en production

Variables obligatoires côté backend (le serveur refuse de démarrer sinon) :

| Variable | Rôle |
|---|---|
| `NODE_ENV=production` | Active les vérifications de production |
| `DATABASE_URL` | Base PostgreSQL |
| `JWT_SECRET` | Au moins 32 caractères aléatoires |
| `FRONTEND_URL` | Adresse publique du frontend en `https://…` (utilisée dans les liens et QR codes envoyés aux clients) |
| `CORS_ORIGIN` | Facultatif, par défaut `FRONTEND_URL` |
| `TRUST_PROXY` | Facultatif, par défaut `1` en production (hébergeur devant le serveur) |

Côté frontend : `VITE_API_URL` si l'API n'est pas servie sur le même domaine sous `/api`. Toutes les routes du frontend doivent renvoyer `index.html` (application monopage).

Hébergement conseillé (SPEC) : backend + PostgreSQL sur Railway ou Render (sauvegardes automatiques à activer), frontend sur Vercel ou Netlify.

---

## Documentation

- [`SPEC.md`](./SPEC.md) — Spécification fonctionnelle v3.1 (règles métier, écrans, modèle de données)
- [`02-PLAN_MAQUETTE.md`](./02-PLAN_MAQUETTE.md) — Intégration de la maquette, écarts et décisions
- [`AG_RULES.md`](./AG_RULES.md) — Règles de qualité, sécurité et structure obligatoires
- [`TEST_DATA.md`](./TEST_DATA.md) — Comptes de démonstration et scénarios de test
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Guide de contribution et configuration GitHub

---

## Stratégie de branches

| Branche | Usage |
|---|---|
| `main` | Toujours déployable, **merge réservé à l'owner du repo** |
| `dev` | Branche d'intégration commune |
| `feature/<sujet>` | Nouvelle fonctionnalité, créée depuis `dev` |
| `fix/<sujet>` | Correction de bug, créée depuis `dev` |
| `chore/<sujet>` | Tâche technique, créée depuis `dev` |
| `hotfix/<sujet>` | Bug en production, créée depuis `main`, remergée dans `main` ET `dev` |

- Nommage incluant le numéro d'issue quand disponible : `fix/42-heure-limite-non-respectee`
- Commits au format **Conventional Commits** : `feat(orders): ...`, `fix(auth): ...`, `chore(ci): ...`
- **Squash merge** pour un historique propre
- **Les PR vers `main` sont réservées à l'owner du repo**

---

## Structure du monorepo

```
meal-app/
├── apps/
│   ├── backend/            # API Express + Prisma (routes → controllers → services → repositories)
│   │   ├── prisma/         # Schéma, migrations, seed
│   │   └── tests/          # unit/, integration/ (HTTP sans base), db/ (PostgreSQL réel)
│   └── frontend/           # React + Tailwind
│       ├── public/         # Polices, logos et photos de la maquette
│       └── src/
│           ├── api/        # Client HTTP et appels typés
│           ├── components/ # Composants de la DA (ui/) et blocs partagés
│           ├── features/   # Session (auth)
│           ├── lib/        # Formats français, calendrier, thème
│           └── pages/      # client/ et admin/
├── packages/
│   └── shared/             # Types, schémas zod et règles de calendrier partagés
├── Maquette/               # Maquette HTML/PDF de référence (hors dépôt)
├── .github/                # CI, templates PR et issues
├── AG_RULES.md             # Règles obligatoires
└── SPEC.md                 # Spécification fonctionnelle
```
