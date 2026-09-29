# Données de Test & Référence de la Base de Données — YourFood

Ce document recense les données injectées par le script de seed ([`prisma/seed.ts`](apps/backend/prisma/seed.ts)), les comptes de démonstration, les codes d'accès, le catalogue culinaire et les scénarios de test recommandés (SPEC v3.1).

---

## 1. Comptes de démonstration

L'identifiant de connexion est **« Prénom Nom »** (sans tenir compte des accents ni de la casse).

| Rôle | Identifiant | Téléphone | Accès | Abonnement |
| :--- | :--- | :--- | :--- | :--- |
| **Administratrice** | `Sarah BOKETSU` | `+243810000001` | Mot de passe `Admin@2026!` | — |
| **Client 25 000 FC** | `Patrick KABAMBA` | `+243812345678` | Code **`KP7X8A9B`** (à saisir avec l'identifiant) | 4 semaines, du lundi de la semaine en cours au vendredi de la 4ᵉ semaine. Viande le lundi et le vendredi |
| **Client 35 000 FC** | `Jean MUTOMBO` | `+243823456789` | Code **`MJ4D5E6F`** | Idem, viande tous les jours |
| **Client expiré** | `Freddy KALALA` | aucun (téléphone facultatif) | Mot de passe `Client@2026!` | 2 semaines, terminé la semaine dernière : accès grisé (SPEC 5.11) |
| **Client pas encore actif** | `Grâce MWAMBA` | `+243841039965` | Code **`MG5H6J7K`** | 1 semaine, commence lundi prochain |

Tous les abonnements commencent un **lundi** et finissent un **vendredi**.

> [!NOTE]
> **Première connexion** : le client saisit son identifiant + son code (`POST /api/auth/verify-code`, qui ne consomme pas le code), puis choisit son mot de passe (`POST /api/auth/first-login`, 8 caractères minimum). Ensuite : identifiant + mot de passe. Le lien d'accès a la forme `…/bienvenue#CODE` (le code est après le « # »).

---

## 2. Catalogue de Plats Locaux (13 Spécialités)

### 🍲 Plats principaux (`plat`)
1. **Poulet à la Moambé**
2. **Maboke de Capitaine en papillote**
3. **Poisson Braisé aux épices douces**
4. **Bœuf sauté aux légumes locaux**

### 🍚 Accompagnements (`accompagnement`)
1. **Fufu de maïs et manioc**
2. **Chikwangue artisanale**
3. **Riz blanc parfumé**
4. **Bananes plantains frites (Makemba)**
5. **Pommes sautées croustillantes**

### 🥩 Viandes (`viande`)
1. **Kamundele** (brochettes de viande de chèvre braisée)
2. **Poulet Mayo braisé à la kinois**
3. **Côtelettes de porc dorées**
4. **Viande de bœuf fumée à la sauce tomate**

---

## 3. Menus de référence

Le seed publie le menu des **3 prochains jours ouvrés** (aujourd'hui inclus s'il est ouvré), avec 2 plats, 2 accompagnements et 2 viandes. Le nombre d'options par catégorie est libre : ces 6 options ne sont qu'un exemple.

- **Heure limite indicative** : `13:00` (réglable de 11h00 à 19h00 par jour)
- **Verrouillage automatique** : `20:00`
- **Fuseau horaire** : `Africa/Kinshasa` (UTC+1)

---

## 4. Scénarios de test

### Scénario A : Première connexion
1. `POST /api/auth/verify-code` avec `identifiant: "Patrick KABAMBA"`, `code: "KP7X 8A9B"` (l'espace est toléré) → 200, code **non consommé**.
2. `POST /api/auth/first-login` avec le même couple et `nouveauMotDePasse: "MonMotDePasse2026!"` → 200, code consommé, JWT renvoyé avec l'abonnement et son état.
3. Rejouer l'étape 2 → 400 (code déjà utilisé).

### Scénario B : Viande selon la formule
- Mardi, mercredi, jeudi : Patrick (25 000 FC) n'a pas de viande (`estViandeAutoriseeAujourdhui = false`, et une commande avec viande est refusée) ; Jean (35 000 FC) doit choisir sa viande.
- Lundi et vendredi : les deux ont la viande.

### Scénario C : Verrouillage à 20h, annulation et commande par défaut
1. Avant 20h : commander, modifier, annuler et même **reprendre** son repas sont possibles.
2. Un client qui **annule sans avoir rien confirmé** n'est **pas** servi à 20h.
3. À 20h00 (automatique) : le menu passe en « verrouillé » ; les clients dont l'abonnement couvre le jour, sans choix ni annulation, reçoivent l'option la plus demandée par catégorie (`estDefaut = true`). Un client Formule 25 000 ne reçoit pas de viande un mardi.
4. Après 20h : commander ou annuler → 403.

### Scénario D : Abonnements
- `Freddy KALALA` peut se connecter : réponse avec `etat: "expire"`, menu et historique grisés.
- `Grâce MWAMBA` ne peut pas se connecter avant lundi : 403 « Ton abonnement commence le lundi … ».
- Renouveler Jean : la nouvelle période commence **le lundi qui suit la fin de la période en cours** ; l'ancienne reste valable jusqu'à sa fin.

### Scénario E : Suivi du jour (Admin)
1. `GET /api/admin/orders/live` avec le token de Sarah BOKETSU.
2. Résultat attendu : compteurs par plat, lignes avec origine (`choisi` / `automatique`), clients en attente, clients ayant annulé, compteur de préparés. Cocher via `PATCH /api/admin/orders/:orderId/prepare`.

### Scénario F : Accès sans téléphone
- Créer un client sans `telephone` : la réponse contient `acces.lien`, `acces.code` et `acces.message`, mais `acces.whatsappUrl` vaut `null` (le lien s'affiche en QR code côté frontend).

---

## 5. Commandes d'Exécution & Outils

```bash
# 1. Démarrer PostgreSQL et appliquer les migrations
docker-compose up -d
npm run prisma:migrate

# 2. Exécuter le seed de la base de données
npm run prisma:seed --workspace=@meal-app/backend

# 3. Lancer la suite de tests du backend
npm run test --workspace=@meal-app/backend

# 4. Ouvrir Prisma Studio pour inspecter les données
npm run prisma:studio --workspace=@meal-app/backend
```
