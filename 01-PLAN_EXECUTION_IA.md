# Plan d'exécution — Création du repository "meal-app"

Ce document est destiné à un agent IA (Antigravity ou autre) chargé de **créer l'intégralité de la structure du repository** avant que le développement des fonctionnalités ne commence. Il doit être exécuté une seule fois, au tout début du projet, dans l'ordre indiqué.

Avant toute action : lire `AG_RULES.md` (déjà présent dans le repo) et respecter strictement ses règles de qualité, sécurité et structure tout au long de l'exécution de ce plan.

---

## 1. Contexte du projet (à connaître avant de commencer)

Application web permettant à des clients abonnés de commander chaque jour un repas (parmi des options limitées) livré par une administratrice de restauration. Voir `SPEC.md` (à créer à partir du cahier des charges fonctionnel fourni séparément) pour le détail des règles métier : formules d'abonnement, heure limite, gestion du non-choix, dashboard admin, etc.

**Stack technique imposée :**
- Frontend : React + React Router + Tailwind CSS
- Backend : Node.js / Express
- Base de données : PostgreSQL + Prisma (ORM)
- Authentification : JWT + bcrypt
- Validation : zod
- Dates : dayjs (timezone Africa/Kinshasa)
- Graphiques admin : Recharts
- Génération de code d'accès : module `crypto` natif de Node
- Sécurité : express-rate-limit

**Organisation en monorepo** avec workspaces (npm ou pnpm), pas de microservices, pas de cache, pas de file de messages.

---

## 2. Arborescence à créer

Créer exactement cette structure de dossiers et fichiers (fichiers vides ou avec un contenu minimal de démarrage, sauf indication contraire) :

```
meal-app/
├── AG_RULES.md                          # déjà fourni — ne pas écraser
├── README.md                            # à générer (voir section 3)
├── SPEC.md                              # cahier des charges fonctionnel complet
├── .gitignore
├── .env.example
├── package.json                         # racine, définit les workspaces
├── .github/
│   ├── workflows/
│   │   ├── ci-backend.yml
│   │   └── ci-frontend.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .eslintrc.json
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── middlewares/
│   │   │   ├── validations/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── tests/
│   └── frontend/
│       ├── package.json
│       ├── tsconfig.json
│       ├── .eslintrc.json
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── features/
│       │   ├── api/
│       │   ├── hooks/
│       │   └── styles/
│       └── tests/
└── packages/
    └── shared/
        ├── package.json
        └── src/
            ├── types/
            └── schemas/
```

---

## 3. Contenu du `README.md` (racine)

Générer un README qui contient, dans cet ordre :
1. Nom et description courte du projet (une phrase)
2. Stack technique (reprendre la liste de la section 1)
3. Instructions d'installation locale (`npm install`, copier `.env.example` vers `.env`, lancer les migrations Prisma, démarrer front et back)
4. Lien vers `AG_RULES.md` et `SPEC.md`
5. Rappel de la stratégie de branches (voir section 5) et du fait que les PR vers `main` sont réservées à l'owner du repo

---

## 4. Contenu du `SPEC.md`

Reprendre intégralement le cahier des charges fonctionnel validé (formules d'abonnement à 25 000 FC et 35 000 FC, inscription 100% côté admin, génération de code à 8 caractères, authentification JWT, offre journalière à 3 catégories/2 options, heure limite indicative + verrouillage absolu à 20h, gestion du non-choix, avis/notation, dashboard admin, modèle de données) sans le résumer ni le simplifier — c'est la référence unique que tout agent IA doit consulter avant de coder une fonctionnalité métier.

---

## 5. Fichiers `.github/` à générer

### `.github/workflows/ci-backend.yml`
Pipeline qui se déclenche sur chaque pull request touchant `apps/backend/**` ou `packages/shared/**` :
1. Installation des dépendances
2. Lint (ESLint)
3. Typecheck (`tsc --noEmit`)
4. Tests (unitaires + intégration)
5. Build

### `.github/workflows/ci-frontend.yml`
Même logique, déclenché sur `apps/frontend/**` ou `packages/shared/**` : lint, typecheck, tests, build.

### `.github/pull_request_template.md`
Doit inclure une checklist reprenant explicitement les points de la section 10 d'`AG_RULES.md` :
```markdown
## Description de la PR


## Checklist
- [ ] Lint / typecheck OK
- [ ] Tests ajoutés ou mis à jour
- [ ] Validations des entrées présentes (zod)
- [ ] Aucun secret exposé dans le code
- [ ] Pas de régression connue
- [ ] AG_RULES.md respecté
```

### `.github/ISSUE_TEMPLATE/bug_report.md`
Champs obligatoires : comportement attendu, comportement observé, étapes de reproduction, capture d'écran si pertinent.

### `.github/ISSUE_TEMPLATE/feature_request.md`
Champs obligatoires : besoin, solution envisagée, alternatives considérées.

---

## 6. Règles GitHub à configurer (ne peut pas être fait par un agent IA — à faire manuellement par l'owner du repo)

Lister ces étapes dans le README ou dans un fichier `CONTRIBUTING.md` séparé, car elles doivent être réalisées manuellement dans les paramètres GitHub par le propriétaire du repo :

- Branch protection sur `main` : PR obligatoire, au moins 1 review, CI obligatoire, restriction du merge à l'owner uniquement, "Do not allow bypassing"
- Branch protection sur `dev` : PR obligatoire, CI obligatoire, ouvert aux deux contributeurs
- Ajout du collaborateur (le développeur frontend) avec droits d'écriture (pas admin)

---

## 7. Stratégie de branches à respecter dans tout le travail futur

- `main` → toujours déployable, merge réservé à l'owner du repo
- `dev` → branche d'intégration commune
- `feature/<sujet>`, `fix/<sujet>`, `chore/<sujet>` → une branche par tâche/issue, créée depuis `dev`
- `hotfix/<sujet>` → créée depuis `main` en cas de bug en production, remergée dans `main` ET `dev`
- Nommage recommandé incluant le numéro d'issue quand disponible : `fix/42-heure-limite-non-respectee`
- Commits au format Conventional Commits (`feat(orders): ...`, `fix(auth): ...`, `chore(ci): ...`)
- Squash merge pour garder un historique propre

---

## 8. `packages/shared` — à initialiser en priorité

Avant tout développement de fonctionnalité, définir dans `packages/shared/src/types/` les types partagés suivants (à minima) : `User`, `Subscription`, `AccessCode`, `DailyOffer`, `OfferOption`, `Order`, `Review`. Définir dans `packages/shared/src/schemas/` les schémas zod correspondants, utilisés à la fois par le backend (validation des requêtes) et le frontend (validation des formulaires). Ce dossier doit être créé et rempli avant que le backend ou le frontend ne commencent le développement des fonctionnalités métier, pour garantir la cohérence des données entre les deux applications.

---

## 9. Ordre d'exécution recommandé pour l'agent IA

1. Créer l'arborescence complète (section 2)
2. Générer `README.md` et `SPEC.md`
3. Générer les fichiers `.github/`
4. Initialiser `packages/shared` avec les types et schémas de base
5. Initialiser `apps/backend` (package.json, tsconfig, Prisma schema basé sur le modèle de données de `SPEC.md`)
6. Initialiser `apps/frontend` (package.json, tsconfig, structure Tailwind)
7. Vérifier que la CI se déclenche correctement sur une première PR de test
8. Signaler à l'utilisateur les étapes manuelles restantes (section 6) qu'il doit effectuer lui-même sur GitHub
