# Données de Test & Référence de la Base de Données — YourFood

Ce document recense l'ensemble des données de test injectées par le script de seed ([`prisma/seed.ts`](file:///c:/Users/user/OneDrive/Documents/YourFood/apps/backend/prisma/seed.ts)), les comptes de démonstration, les codes d'accès, le catalogue culinaire et les scénarios de test recommandés.

---

## 1. Comptes Utilisateurs de Démonstration

| Rôle | Nom & Prénom | Téléphone normalisé | Identifiant de connexion | Mot de passe / Code d'activation | Détails de l'abonnement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Administratrice** | `BOKETSU Sarah` | `+243810000001` | Nom : `BOKETSU` | `Admin@2026!` (haché bcrypt) | Accès complet Dashboard, Gestion clients, Offres, Cuisine |
| **Client (25 000 FC)** | `KABAMBA Patrick` | `+243812345678` | Nom : `KABAMBA` | Code : **`KP7X8A9B`** | Formule 25k : viande autorisée **lundi et vendredi uniquement** (30 jours) |
| **Client (35 000 FC)** | `MUTOMBO Jean` | `+243823456789` | Nom : `MUTOMBO` | Code : **`MJ4D5E6F`** | Formule 35k : viande autorisée **du lundi au vendredi** (30 jours) |

> [!NOTE]
> Pour les clients, lors de la **première connexion**, l'utilisateur saisit son **Nom** + son **Code d'activation à 8 caractères** sur l'écran `/first-login`, puis définit son mot de passe personnel. Pour les connexions suivantes, il utilise son **Nom** + **Mot de passe**.

---

## 2. Catalogue de Plats Locaux (13 Spécialités)

Conformément à la spécification, le catalogue est structuré en 3 catégories strictes :

### 🍲 Plats principaux (`plat`)
1. **Poulet à la Moambé** (sauce graine traditionnelle)
2. **Maboke de Capitaine en papillote** (poisson d'eau douce aux aromates locaux cuit à l'étouffée)
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

## 3. Offre du Jour de Référence

L'offre insérée pour la date courante comporte **exactement 6 options** (2 de chaque catégorie) :

- **Heure limite indicative** : `13:00`
- **Heure limite absolue (verrouillage)** : `20:00`
- **Fuseau horaire d'application** : `Africa/Kinshasa` (UTC+1)
- **Options au menu :**
  - Plats (2) : *Poulet à la Moambé* & *Poisson Braisé aux épices douces*
  - Accompagnements (2) : *Fufu de maïs et manioc* & *Bananes plantains frites (Makemba)*
  - Viandes (2) : *Kamundele* & *Poulet Mayo braisé à la kinois*

---

## 4. Matrice des Scénarios de Test

### Scénario A : Première connexion client
1. Appel `POST /api/auth/first-login` :
   - `nom`: `"KABAMBA"`
   - `code`: `"KP7X8A9B"`
   - `nouveauMotDePasse`: `"MonMotDePasse2026!"`
2. **Résultat attendu** : Code HTTP 200, code marqué comme utilisé (`utilise = true`), mot de passe enregistré en base avec hash bcrypt, JWT renvoyé avec rôle `client` et `subscriptionId`.

### Scénario B : Règle de sélection de la viande (25k vs 35k)
- Si le jour est **Mardi**, **Mercredi** ou **Jeudi** :
  - Patrick (`KABAMBA`, 25 000 FC) -> la viande est désactivée (`estViandeAutoriseeAujourdhui = false`).
  - Jean (`MUTOMBO`, 35 000 FC) -> la viande est activée (`estViandeAutoriseeAujourdhui = true`).
- Si le jour est **Lundi** ou **Vendredi** :
  - Les deux clients ont accès à la sélection de la viande.

### Scénario C : Verrouillage à 20h et attribution des commandes par défaut
1. Avant 20h : modification et annulation de commande autorisées.
2. À partir de 20h : tentative de commande ou d'annulation rejetée avec `403 Forbidden` (`Menu verrouillé après 20h`).
3. Pour les clients n'ayant pas commandé avant 20h : le système leur attribue automatiquement l'option la plus commandée par catégorie pour le lendemain (`estDefaut = true`).

### Scénario D : Dashboard de préparation en cuisine (Admin)
1. Appel `GET /api/admin/orders/live` avec le token de Sarah BOKETSU.
2. **Résultat attendu** :
   - Compteurs exacts par plat (ex: `Poulet à la Moambé: 1`, `Fufu: 1`).
   - Liste des clients à livrer avec indicateur `prepare` (modifiable en direct via `PATCH /api/admin/orders/:orderId/prepare`).

---

## 5. Commandes d'Exécution & Outils

```bash
# 1. Exécuter le seed de la base de données
npm run prisma:seed --workspace=@meal-app/backend

# 2. Lancer la suite complète de 29 tests (unitaires + intégration)
npm run test --workspace=@meal-app/backend

# 3. Ouvrir l'interface visuelle Prisma Studio pour inspecter les données
npm run prisma:studio --workspace=@meal-app/backend
```
