# AG_RULES.md

## 1. Objectif

Ce document définit les règles obligatoires pour tous les agents IA, développeurs et outils d'automatisation travaillant sur ce dépôt. Il doit être lu avant chaque action, chaque génération de code et chaque correction.

Toute modification doit être conforme à ces règles, aux bonnes pratiques de développement logiciel et aux standards de sécurité modernes.

Si une demande utilisateur contredit ces règles, l'agent doit refuser poliment et proposer une alternative conforme.

---

## 2. Principes fondamentaux

### 2.1 Qualité logicielle

- Produire du code propre, lisible, cohérent et maintenable.
- Écrire des fonctions courtes et focalisées.
- Utiliser des noms explicites et cohérents.
- Éviter les duplications, les anti-patterns et le code “spaghetti”.
- Préférer des composants, services et modules bien séparés.
- Ne pas laisser de code mort, de commentaires inutiles ou de logs sensibles.

### 2.2 TypeScript et JavaScript

- Utiliser TypeScript strict chaque fois que possible.
- Activer les vérifications strictes (`strict`, `noImplicitAny`, etc.) dans le code et les configs.
- Éviter `any` sauf si justifié et documenté.
- Préférer les types explicites aux `as any` répétés.
- Utiliser `async/await` partout ; éviter `.then()`, callbacks imbriqués et code asynchrone complexe.

### 2.3 Structure du projet

- Respecter la séparation MVC / services / repositories / validations / middlewares.
- Garder la logique réseau séparée de la logique métier.
- Éviter de mélanger configuration serveur, sécurité, validation, business logic et accès base de données dans un seul fichier.
- Garder les modules petits, testables et cohérents par domaine métier.

### 2.4 Conventions de code

- Respecter ESLint et Prettier.
- Écrire du code formaté de façon cohérente.
- Documenter les fonctions publiques et les points d’intégration complexes.
- Gérer les cas limites, les erreurs et les états vides explicitement.
- Les erreurs doivent être traitées sans masquer la cause réelle.

---

## 3. Règles de sécurité

### 3.1 Secrets et configuration

- Ne jamais coder de secrets, clés API, tokens, mots de passe ou jetons dans le dépôt.
- Utiliser des variables d’environnement et des fichiers `.env` non versionnés.
- Vérifier les valeurs de configuration au démarrage.
- Refuser toute valeur par défaut dangereuse pour les secrets JWT, DB, clés de paiement ou API.

### 3.2 Validation des entrées

- Valider toutes les entrées utilisateur, JSON, headers, query params et fichiers uploadés.
- Privilégier Zod ou une validation équivalente avant traitement.
- Sanitize les entrées avant insertion SQL, logs ou génération HTML.
- Ne pas faire confiance à l’utilisateur ou à des payloads tiers.

### 3.3 Sécurité réseau et API

- Vérifier les schémas de routes Express, les rôles et les permissions.
- Limiter les appels, les tentatives répétées et les bruteforces avec des rate limits.
- Utiliser CORS strict en production.
- Appliquer les bonnes politiques de cookie et de headers HTTP (HttpOnly, Secure, SameSite, CSP, etc.).
- Éviter les fuites d’information dans les messages d’erreur.

### 3.4 Sécurité base de données

- Préférer Prisma ou des requêtes paramétrées.
- Éviter les injections SQL et les concaténations de requêtes.
- Toujours sécuriser les filtres côté serveur et les accès multi-tenant.
- Vérifier les droits d’accès par école, rôle et utilisateur.
- Ne pas supprimer des données sans garde-fou ni transaction appropriée.

### 3.5 Sécurité fichiers uploads

- Vérifier taille, type MIME et extension des fichiers téléchargés.
- Stocker les fichiers dans des dossiers dédiés avec permissions minimales.
- Ne pas exposer directement des fichiers non autorisés.
- Sanitize les noms de fichiers et éviter le path traversal.

---

## 4. Règles backend (Node.js / Express / Prisma / PostgreSQL)

### 4.1 Backend

- Préférer des contrôleurs fins, des services métier et des repos dédiés.
- Gérer les erreurs avec des exceptions typées et des middlewares centralisés.
- Répondre avec des codes HTTP cohérents.
- Utiliser des transactions pour les opérations multi-étapes critiques.
- Rester compatible avec les bonnes pratiques de production.

### 4.2 Prisma / PostgreSQL

- Ne pas modifier directement les schémas de manière destructrice sans migration sûre.
- Respecter les conventions de migration et les stratégies de compatibilité.
- Éviter les opérations massives non contrôlées dans les environnements de prod.
- Ajouter des index sur les champs de recherche fréquente.
- Mettre des contraintes appropriées et un système d’audit pour les données sensibles.

### 4.3 Express

- Séparer routers, middleware et contrôleurs.
- Ne pas placer la logique métier dans les routes.
- Utiliser des middlewares standardisés pour auth, rôle, tenant, validation, erreurs et rate limit.
- Éviter les handlers trop gros et les traitements bloquants dans le thread principal.

---

## 5. Règles frontend / intégration

### 5.1 Qualité UI et code

- Préférer les composants réutilisables et simples.
- Éviter les composants monolithes.
- Gérer les états de chargement, erreur et vide clairement.
- Préférer des callbacks stables et des hooks avec logique découpée.

### 5.2 Sécurité frontend

- Ne pas stocker de secrets côté navigateur.
- Ne pas exposer des données sensibles dans le client sans besoin.
- Vérifier les permissions et accès côté interface, sans dépendre uniquement du frontend.

---

## 6. Tests obligatoires

- Écrire des tests unitaires pour les services métier critiques.
- Ajouter des tests d’intégration pour les points d’entrée HTTP importants.
- Tester les validations, les cas d’erreur, les rôles, la sécurité et la logique multi-tenant.
- Les tests doivent couvrir au minimum : succès, erreur, cas limites, accès non autorisé.
- Ne pas écrire des tests qui valident uniquement des mocks sans comportement réel.

---

## 7. CI / qualité / déploiement

- Le code doit pouvoir passer lint, typecheck et tests avant merge.
- Le dépôt doit avoir une pipeline CI minimale : lint, build, test, sécurité de base.
- Vérifier les secrets environnements avant déploiement.
- Utiliser des contrôles de déploiement sûr : healthchecks, env validation, rollback plan, logs centralisés.
- Préparer les environnements de prod avec séparer les dépendances, secrets et accès réseau.

---

## 8. Règles spécifiques de l’agent IA

### 8.1 Avant toute action

- Charger ce fichier AG_RULES.md avant chaque analyse, génération, correction ou amélioration.
- Vérifier si la requête ou le code existant respecte ces règles.
- Refuser les tâches non conformes et proposer une alternative conforme.

### 8.2 Avant la génération de code

- Analyser le contexte et le code existant.
- Détecter les erreurs, incohérences, doublons, failles de sécurité et mauvaises pratiques.
- Expliquer clairement ce qui ne correspond pas aux règles.
- Proposer une solution corrigée et conforme.
- Vérifier la conformité après génération.

### 8.3 Lors de la correction

- Identifier précisément l’origine du problème.
- Justifier pourquoi la solution initiale est incorrecte.
- Corriger avec le plus petit changement utile.
- Vérifier qu’aucune régression n’a été introduite.

### 8.4 Règles d’intégration Antigravity

- L’agent doit toujours charger AG_RULES.md comme contexte système avant chaque session.
- Toute sortie générée doit être validée contre ces règles.
- Si une sortie viole ces règles, elle doit être bloquée ou corrigée avant validation.
- Les résultats de validation doivent être explicites et conservés en log ou en réponse.

---

## 9. Règles de refus

L’agent doit refuser de générer ou de modifier du code si celui-ci :

- expose des secrets,
- utilise des valeurs par défaut dangereuses,
- évite la validation des entrées,
- introduit une injection SQL ou un path traversal,
- ignore les règles d’authentification ou d’autorisation,
- contourne les bonnes pratiques de sécurité ou de qualité,
- viole la séparation des responsabilités ou la structure du projet.

À la place, il doit proposer une alternative conforme.

---

## 10. Checklist finale avant validation

Avant de déclarer une tâche terminée, vérifier :

- [ ] AG_RULES.md a bien été chargé.
- [ ] Le code suit les conventions.
- [ ] Les validations sont présentes.
- [ ] Les secrets sont sécurisés.
- [ ] Les erreurs sont gérées correctement.
- [ ] Le code est testable.
- [ ] Le code est conforme à ESLint/Prettier.
- [ ] Le code est sûr pour la production.
- [ ] Aucune régression n’a été introduite.

---

## 11. Résumé

Le standard attendu est simple : code propre, sûr, testable, modularisé, maintenable, conforme aux bonnes pratiques modernes et strictement aligné sur AG_RULES.md.
