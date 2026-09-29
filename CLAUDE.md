# CLAUDE.md

YourFood (nom de code `meal-app`) : application web d'abonnement et de commande de repas quotidiens. Une administratrice unique gère ~100 clients (pas d'auto-inscription). Langue du projet et des échanges : français.

## Documents de référence (à lire avant de coder)
- `SPEC.md` : spécification fonctionnelle **v3.1** (source de vérité métier ; section 12 = changements par rapport à la v3).
- `02-PLAN_MAQUETTE.md` : plan d'intégration de la maquette (`Maquette/`) et décisions prises.
- `AG_RULES.md` : règles obligatoires de qualité, sécurité et structure. Les respecter strictement.
- `TEST_DATA.md` : données de test. `CONTRIBUTING.md` : workflow de contribution.

## Stack
Monorepo npm workspaces :
- `apps/backend` : Node + Express + TypeScript, Prisma + PostgreSQL, JWT + bcrypt, zod, express-rate-limit, dayjs.
- `apps/frontend` : React 19 + React Router 7 + Tailwind + Vite, Recharts (dashboard admin).
- `packages/shared` : types et schémas zod partagés (`@meal-app/shared`).

Architecture volontairement simple : un serveur, une base, pas de cache ni de file de messages.

## Commandes (depuis la racine)
- `docker-compose up -d` : PostgreSQL local (Docker Desktop doit tourner). Copier `.env.example` vers `apps/backend/.env` (lu par le backend, le seed et Prisma). Si le port 5432 est déjà pris par un PostgreSQL installé sur la machine, mettre `POSTGRES_PORT=55432` dans un `.env` à la racine (lu par docker-compose) et ajuster le port dans `DATABASE_URL`.
- `npm run dev:backend` / `npm run dev:frontend`
- `npm run prisma:generate` puis `npm run prisma:migrate` (le generate doit précéder lint/typecheck/build).
- `npm run lint`, `npm run typecheck`, `npm test` (vitest)
- Seed : `npm run prisma:seed --workspace=apps/backend`

## Architecture backend
`routes` → `controllers` → `services` (logique métier) → `repositories` (accès Prisma). Validation zod dans `validations/` et middleware `validate`. Ne pas mélanger ces couches.

## Conventions et pièges
- Fuseau métier : `Africa/Kinshasa` (heure limite de commande, calculs de dates). Toujours passer par `utils/time.ts`.
- Pas de secret en dur, pas de valeur par défaut dangereuse pour JWT/DB.
- TypeScript strict, pas de `any` non justifié, `async/await` uniquement.
- Le code d'activation et le lien ne servent qu'à l'activation initiale du compte, jamais régénérés au renouvellement. Le lien contient le code **après le `#`** (jamais envoyé au serveur) ; l'accès peut aussi passer par WhatsApp ou un QR code.
- Paiement hors application en v1. Prix **hebdomadaires** (25 000 / 35 000 FC), additionnés sur la durée.
- Abonnements : toujours du **lundi au vendredi** ; durée en semaines (1 mois = 4 semaines) ; « jours restants » en jours ouvrés. L'état (actif / bientôt expiré / expiré) se **calcule sur les dates**, jamais sur le champ `statut`. Les règles de dates sont dans `packages/shared/src/utils/subscription.ts`.
- Identifiant de connexion = « prénom nom » normalisé (`login_key`, unique). Le téléphone est facultatif.
- Le verrouillage de 20h est automatique (`scheduler.ts` + à la lecture). Une annulation est enregistrée même sans commande préalable ; les annulés ne reçoivent pas de repas par défaut ; la viande par défaut dépend de la formule.
- Un menu compte au moins un plat, un accompagnement et une viande, sans maximum par catégorie.

## Git
- Branche de travail : `dev` ; `main` est la branche stable. Commits clairs et incrémentaux (style `feat(scope): ...`, `fix(ci): ...`).
- Demander l'avis de l'utilisateur avant tout changement majeur.

## État d'avancement
- Fait : structure, CI, schéma Prisma + migrations, backend aligné sur la SPEC v3.1 (phase 1 du plan : auth en deux étapes, abonnements lundi-vendredi, verrouillage automatique, endpoints historique / stats / menus / clients), tests unitaires du backend.
- À faire : tests d'intégration avec base, frontend (phases 2 à 5 du plan, en attente de validation), README complet. Les migrations et le seed ont été exécutés et vérifiés sur PostgreSQL.
