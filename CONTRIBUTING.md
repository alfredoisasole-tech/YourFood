# CONTRIBUTING.md — Guide de contribution

## Règles de contribution

Avant toute contribution, lire et respecter :
- [`AG_RULES.md`](./AG_RULES.md) — Règles de qualité, sécurité et structure
- [`SPEC.md`](./SPEC.md) — Cahier des charges fonctionnel

---

## Stratégie de branches

- `main` → toujours déployable, merge réservé à l'owner du repo
- `dev` → branche d'intégration commune
- `feature/<sujet>`, `fix/<sujet>`, `chore/<sujet>` → une branche par tâche/issue, créée depuis `dev`
- `hotfix/<sujet>` → créée depuis `main` en cas de bug en production, remergée dans `main` ET `dev`
- Nommage incluant le numéro d'issue : `fix/42-heure-limite-non-respectee`
- Commits au format Conventional Commits (`feat(orders): ...`, `fix(auth): ...`, `chore(ci): ...`)
- Squash merge pour garder un historique propre

---

## Configuration GitHub à réaliser par l'owner du repo (manuellement)

> ⚠️ Ces étapes doivent être effectuées dans les paramètres GitHub par le propriétaire du repo. Elles ne peuvent pas être automatisées par un agent IA.

### 1. Branch protection sur `main`

- Aller dans **Settings → Branches → Add branch protection rule**
- Branch name pattern : `main`
- Cocher :
  - ✅ Require a pull request before merging
  - ✅ Require approvals (au moins 1)
  - ✅ Require status checks to pass before merging
    - Ajouter les checks CI (`ci-backend`, `ci-frontend`)
  - ✅ Restrict who can push to matching branches → ajouter uniquement l'owner
  - ✅ Do not allow bypassing the above settings

### 2. Branch protection sur `dev`

- Branch name pattern : `dev`
- Cocher :
  - ✅ Require a pull request before merging
  - ✅ Require status checks to pass before merging
    - Ajouter les checks CI (`ci-backend`, `ci-frontend`)
  - Pas de restriction sur qui peut merge (ouvert aux deux contributeurs)

### 3. Ajout du collaborateur

- Aller dans **Settings → Collaborators and Teams**
- Inviter le développeur frontend avec des droits **Write** (pas Admin)

---

## Processus de pull request

1. Créer une branche depuis `dev` : `git checkout -b feature/mon-sujet dev`
2. Développer la fonctionnalité en respectant AG_RULES.md
3. Pousser la branche et ouvrir une PR vers `dev`
4. Remplir la checklist du template de PR
5. Attendre que la CI passe et qu'un review soit approuvé
6. Squash merge

---

## Checklist avant soumission d'une PR

- [ ] Lint / typecheck OK (`npm run lint && npm run typecheck`)
- [ ] Tests ajoutés ou mis à jour (`npm run test`)
- [ ] Validations des entrées présentes (zod)
- [ ] Aucun secret exposé dans le code
- [ ] Pas de régression connue
- [ ] AG_RULES.md respecté
