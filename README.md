# 🍽️ meal-app — Application d'abonnement de repas

Application web permettant à des clients abonnés de commander chaque jour un repas (parmi des options limitées) livré par une administratrice de restauration.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React + React Router + Tailwind CSS |
| Backend | Node.js / Express |
| Base de données | PostgreSQL + Prisma (ORM) |
| Authentification | JWT + bcrypt |
| Validation | zod |
| Dates | dayjs (timezone Africa/Kinshasa) |
| Graphiques admin | Recharts |
| Génération de code | module `crypto` natif de Node |
| Sécurité | express-rate-limit |

**Organisation** : monorepo avec workspaces npm. Architecture simple — un seul serveur, une seule base, pas de microservices, pas de cache, pas de file de messages.

---

## Installation locale

### Prérequis

- Node.js ≥ 18
- PostgreSQL ≥ 15
- npm ≥ 9

### Étapes

```bash
# 1. Cloner le repo
git clone <url-du-repo>
cd meal-app

# 2. Installer les dépendances (monorepo)
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs réelles (DATABASE_URL, JWT_SECRET, etc.)

# 4. Générer le client Prisma
npm run prisma:generate

# 5. Lancer les migrations
npm run prisma:migrate

# 6. Démarrer le backend
npm run dev:backend

# 7. Démarrer le frontend (dans un second terminal)
npm run dev:frontend
```

---

## Documentation

- [`AG_RULES.md`](./AG_RULES.md) — Règles de qualité, sécurité et structure obligatoires pour tous les agents et développeurs
- [`SPEC.md`](./SPEC.md) — Cahier des charges fonctionnel complet (formules d'abonnement, inscription, offres, commandes, dashboard admin, etc.)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Guide de contribution et étapes de configuration GitHub

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
│   ├── backend/      # API Express + Prisma
│   └── frontend/     # React + Tailwind
├── packages/
│   └── shared/       # Types et schémas zod partagés
├── .github/          # CI, templates PR et issues
├── AG_RULES.md       # Règles obligatoires
├── SPEC.md           # Cahier des charges fonctionnel
└── CONTRIBUTING.md   # Guide de contribution
```
