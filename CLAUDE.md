# CLAUDE.md

YourFood (nom de code `meal-app`) : application web d'abonnement et de commande de repas quotidiens. Une administratrice unique gère ~100 clients (pas d'auto-inscription). Langue du projet et des échanges : français.

## Documents de référence (à lire avant de coder)
- `SPEC.md` : spécification fonctionnelle finale v3 (source de vérité métier).
- `AG_RULES.md` : règles obligatoires de qualité, sécurité et structure. Les respecter strictement.
- `TEST_DATA.md` : données de test. `CONTRIBUTING.md` : workflow de contribution.

## Stack
Monorepo npm workspaces :
- `apps/backend` : Node + Express + TypeScript, Prisma + PostgreSQL, JWT + bcrypt, zod, express-rate-limit, dayjs.
- `apps/frontend` : React 19 + React Router 7 + Tailwind + Vite, Recharts (dashboard admin).
- `packages/shared` : types et schémas zod partagés (`@meal-app/shared`).

Architecture volontairement simple : un serveur, une base, pas de cache ni de file de messages.

## Commandes (depuis la racine)
- `docker-compose up -d` : PostgreSQL local. Copier `.env.example` vers `.env`.
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
- Le code d'activation et le lien ne servent qu'à l'activation initiale du compte, jamais régénérés au renouvellement.
- Paiement hors application en v1.

## Git
- Branche de travail : `dev` ; `main` est la branche stable. Commits clairs et incrémentaux (style `feat(scope): ...`, `fix(ci): ...`).
- Demander l'avis de l'utilisateur avant tout changement majeur.

## État d'avancement
- Fait : structure, CI, schéma Prisma + migration, backend complet, tests backend partiels.
- À faire : tests des services métier, frontend (socle, espace client, panel admin), README complet.
