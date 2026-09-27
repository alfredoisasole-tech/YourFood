# Spécification finale — Application d'abonnement de repas

## 1. Contexte

Une administratrice possède un business de restauration et livre de la nourriture du lundi au vendredi. L'application permet à environ une centaine de clients de s'abonner et de commander leurs plats selon l'offre journalière. L'inscription et la gestion des clients sont entièrement contrôlées par l'administratrice — aucune auto-inscription libre.

---

## 2. Stack technique

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React + React Router + Tailwind CSS | Interface client et admin |
| Backend | Node.js / Express | API REST |
| Base de données | PostgreSQL + Prisma (ORM) | Persistance, migrations |
| Authentification | JWT + bcrypt | Sessions, hachage des mots de passe |
| Validation | zod | Règles métier côté API |
| Dates | dayjs + timezone Africa/Kinshasa | Heures limites, calculs de durée |
| Graphiques | Recharts | Dashboard admin |
| Génération de code | crypto (natif Node) | Code d'activation à 8 caractères |
| Sécurité | express-rate-limit | Protection des routes de connexion contre le brute-force |
| Notifications admin | Polling (15–20s) par défaut | Suivi en direct des commandes ; passage à Socket.io possible plus tard sans changer l'architecture REST |

Architecture volontairement simple : un seul serveur Node, une seule base PostgreSQL, pas de microservices, pas de cache, pas de file de messages.

Hébergement conseillé : backend + PostgreSQL sur Railway ou Render (sauvegardes automatiques incluses) ; frontend React sur Vercel ou Netlify.

---

## 3. Rôles

- **Administrateur** — compte unique fixe (identifiant + mot de passe), créé une fois au lancement. Inscrit les clients, gère le catalogue, publie les menus, consulte le dashboard.
- **Client** — accède uniquement via le lien fourni par l'admin à l'activation. Consulte le menu du jour, commande, annule, laisse des avis.

---

## 4. Formules d'abonnement

| Formule | Prix | Détail |
|---|---|---|
| Formule 1 | 25 000 FC | Viande incluse uniquement le lundi et le vendredi |
| Formule 2 | 35 000 FC | Viande incluse toute la semaine |

Paiement hors application en v1 (l'admin constate le paiement, puis crée le compte). Paiement intégré prévu en v2.

---

## 5. Fonctionnalités détaillées

### 5.1 Inscription (100% côté admin)
Formulaire : nom, prénom, numéro de téléphone (normalisé avec indicatif pays à la saisie), formule, durée, date de début, date de fin (calculée automatiquement), champ « bonus » (non encore défini). Le service réel ne démarre qu'à la date de début, même si le lien est transmis avant.

### 5.2 Code d'activation et lien
Bouton « Créer » → génère :
- Un code à 8 caractères : 2 initiales (nom + prénom) + 6 caractères aléatoires (lettres, chiffres, `-`, `_`, `.`), unique en base.
- Un lien unique encodant les infos du forfait.

Le code et le lien ne servent **qu'à l'activation initiale du compte** (comme un abonnement Spotify) — jamais régénérés à un renouvellement. Le code reste valable indéfiniment jusqu'à sa première utilisation (pas de délai d'expiration).

Un bouton « Envoyer » ouvre directement WhatsApp (Web/mobile) avec un message de bienvenue pré-rempli (lien + code).

### 5.3 Authentification
- Première connexion : nom + code (saisi une seule fois) → création du mot de passe par le client (l'admin ne le connaît jamais).
- Connexions suivantes : nom + mot de passe uniquement.
- Mot de passe modifiable librement par le client, stable d'une période à l'autre.
- **Mot de passe oublié** : bouton « Réinitialiser » sur la fiche client → génère un nouveau code à usage unique, envoyé par WhatsApp, même mécanisme que l'activation.
- Sessions via JWT, mots de passe hachés avec bcrypt.
- Le code d'activation sert de deuxième couche de sécurité en plus du mot de passe (accès à l'espace du client).

### 5.4 Catalogue de plats
Liste modifiable par catégorie (Plat / Accompagnement / Viande), potentiellement jusqu'à 12 accompagnements et 3–5 viandes. Ajout/modification/suppression d'items.
- Un plat ne peut pas être supprimé tant qu'il est utilisé sur une offre non verrouillée ; l'historique des jours passés reste intact même après suppression ultérieure.
- Un plat peut être désactivé temporairement (masqué du catalogue actif sans être supprimé, utile pour un plat saisonnier), indépendamment de la règle de suppression ci-dessus.

### 5.5 Publication de l'offre du jour
L'admin sélectionne les options dans le catalogue (pas de texte libre) ; la grille (3 catégories × 2 options) se remplit automatiquement. Deux modes de publication :
- **Publier (jour unique, veille pour lendemain)**
- **Publier pour plusieurs jours** : fenêtre avec sélecteur du nombre de jours (limité aux jours ouvrés lundi-vendredi), le même menu est dupliqué sur les jours choisis, chacun restant individuellement modifiable ensuite.

La publication diffuse le menu à tous les clients simultanément.

### 5.6 Menu et commande (client)
3 catégories, 2 options chacune. L'option Viande dépend de la formule. Heure limite indicative configurable par l'admin : après cette heure et avant 20h, l'heure s'affiche en rouge (en retard) mais le choix reste possible. 20h = limite absolue, verrouillage total, menu grisé.

### 5.7 Annulation
Le client peut annuler sa commande du jour avant 20h ; exclue du récapitulatif de préparation.

### 5.8 Commande par défaut
Si le client n'a pas choisi avant 20h : il reçoit l'option la plus demandée parmi les commandes déjà passées ce jour-là, catégorie par catégorie (ou la première option si aucune commande n'existe encore). Notification in-app.

### 5.9 Avis et notation
Sous le menu du jour de consommation, une barre de progression (menu → avis → note étoile), proposée en même temps que le menu suivant. Facultatif, non bloquant, mais important pour les statistiques admin.

### 5.10 Notification admin
Toute action du client (commande, modification, annulation, avis) doit être communiquée à l'administratrice. En v1, ceci se fait via l'écran « Suivi du jour », rafraîchi par polling (15–20s) — pas de notification push nécessaire à ce volume.

### 5.11 Cycle de vie et renouvellement
Le client ne voit que le menu du jour actuel (jamais l'historique en clair). À expiration, son interface devient grisée/non cliquable. Renouvellement : depuis la fiche client, l'admin clique sur « Renouveler / prolonger », choisit la nouvelle durée et peut aussi changer la formule — sans régénérer de code ni de lien. L'ancienne période d'abonnement est conservée en historique (pas écrasée), une nouvelle période est créée. Le client se reconnecte normalement (nom + mot de passe), son accès se réactive automatiquement. Le client reste en base indéfiniment (retrouvable sans réinscription), et ses anciens choix restent visibles en permanence, grisés/inactifs.

---

## 6. Interface admin — navigation et écrans

Barre de navigation latérale, style épuré (inspiration Apple) :
- **Clients** — liste (nom, statut coloré actif/bientôt expiré/expiré) → clic = fiche détaillée
- **Suivi du jour** — vue en direct des choix des clients, devient la vue finale verrouillée après 20h
- **Catalogue** — gestion des plats
- **Publication** — mise en ligne du menu (simple ou multi-jours)
- **Avis** — flux global type discussion (nom, note, commentaire, jour), du plus récent au plus ancien
- **Statistiques** — dashboard graphiques

### Fiche client détaillée
- Bandeau : nom, téléphone, statut, formule, jours restants, bouton Renouveler (action principale), bouton secondaire « Renvoyer le message de bienvenue »
- 3 onglets :
  - **Infos** (dates, bonus)
  - **Historique** (jours passés, statuts, périodes d'abonnement passées)
  - **Avis** (commentaires + note moyenne)

### Dashboard / Statistiques
- En haut : nombre total de clients actifs, nombre de livraisons prévues aujourd'hui
- Un graphique par catégorie (Plat / Accompagnement / Viande), barres dynamiques selon le nombre réel d'options présentes, avec les nombres exacts affichés à côté (pas seulement du visuel)
- Bouton « Détail » → liste simple, client par client (pas de regroupement), avec case à cocher pour marquer « préparé » au fur et à mesure — limitée aux clients actifs. Chaque ligne indique aussi si la commande est automatique (par défaut) ou choisie par le client.

---

## 7. Interface client — écrans

### Connexion
- Première fois : nom + code à 8 caractères → création du mot de passe
- Connexions suivantes : nom + mot de passe
- États d'erreur : identifiants invalides, abonnement pas encore actif (« débute le [date] »)

### Menu du jour
- En-tête avec le jour concerné, 3 catégories en cartes/boutons, heure limite affichée
- Boutons Confirmer / Annuler
- États : normal / en retard (rouge) / verrouillé (grisé après 20h) / commande par défaut reçue / annulée
- Barre de progression facultative (avis + étoile) pour le repas de la veille

### Historique
- Liste des jours passés (triplet choisi ou annulé/défaut), avis laissés — toujours en lecture seule, grisé

---

## 8. Modèle de données

### users
Identité de connexion, admin ou client. Une seule ligne par personne, indépendante des abonnements.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| nom | VARCHAR | NOT NULL |
| prenom | VARCHAR | NOT NULL |
| telephone | VARCHAR | NOT NULL, normalisé avec indicatif pays |
| mot_de_passe_hash | VARCHAR | NULL tant que le client n'a pas encore créé son mot de passe |
| role | ENUM('admin','client') | NOT NULL, défaut 'client' |
| created_at | TIMESTAMP | défaut now() |

### subscriptions
Historique complet des périodes d'abonnement d'un client. Chaque renouvellement crée une nouvelle ligne plutôt que d'écraser la précédente — permet de garder l'historique des formules et périodes passées.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| user_id | INT | NOT NULL, REFERENCES users(id) |
| formule | ENUM('25000','35000') | NOT NULL |
| date_debut | DATE | NOT NULL |
| date_fin | DATE | NOT NULL, calculée automatiquement (date_debut + durée) |
| bonus | VARCHAR | NULL (à définir) |
| statut | ENUM('actif','expire') | NOT NULL, défaut 'actif' |
| created_at | TIMESTAMP | défaut now() |

*Une seule ligne par utilisateur avec statut = 'actif' à la fois (contrôlé en application, pas en contrainte SQL).*

### access_codes
Codes à usage unique : activation initiale ou réinitialisation de mot de passe. Pas de délai d'expiration — valables jusqu'à la première utilisation.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| subscription_id | INT | NOT NULL, REFERENCES subscriptions(id) |
| code | VARCHAR(8) | NOT NULL, UNIQUE |
| type | ENUM('activation','reinitialisation') | NOT NULL |
| date_generation | TIMESTAMP | défaut now() |
| utilise | BOOLEAN | défaut false |
| date_utilisation | TIMESTAMP | NULL |

### catalog_items
Liste des plats disponibles, par catégorie. Suppression bloquée si utilisé sur une offre non verrouillée ; désactivation possible à tout moment sans suppression.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| categorie | ENUM('plat','accompagnement','viande') | NOT NULL |
| nom | VARCHAR | NOT NULL |
| actif | BOOLEAN | défaut true — false = masqué du catalogue actif sans être supprimé |
| created_at | TIMESTAMP | défaut now() |

### daily_offers
Une ligne par jour de livraison.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| date | DATE | NOT NULL, UNIQUE |
| heure_limite_indicative | TIME | NOT NULL, défaut 13:00 |
| statut | ENUM('ouvert','verrouille') | NOT NULL, défaut 'ouvert' |

### offer_options
Les options réellement proposées pour un jour donné (6 lignes par jour : 2 par catégorie).

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| daily_offer_id | INT | NOT NULL, REFERENCES daily_offers(id) |
| catalog_item_id | INT | NOT NULL, REFERENCES catalog_items(id) |
| | | UNIQUE(daily_offer_id, catalog_item_id) |

### orders
Une commande = un triplet de choix, par client, par jour.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| daily_offer_id | INT | NOT NULL, REFERENCES daily_offers(id) |
| subscription_id | INT | NOT NULL, REFERENCES subscriptions(id) |
| plat_id | INT | NOT NULL, REFERENCES offer_options(id) |
| accompagnement_id | INT | NOT NULL, REFERENCES offer_options(id) |
| viande_id | INT | NULL, REFERENCES offer_options(id) — NULL si la formule n'inclut pas la viande ce jour |
| statut | ENUM('en_attente','verrouillee','annulee') | NOT NULL, défaut 'en_attente' |
| est_defaut | BOOLEAN | défaut false |
| prepare | BOOLEAN | défaut false — coché par l'admin lors de la préparation |
| created_at | TIMESTAMP | défaut now() |
| updated_at | TIMESTAMP | mise à jour à chaque modification |
| | | UNIQUE(daily_offer_id, subscription_id) — une seule commande par client par jour |

### reviews
Avis facultatif laissé par le client, lié à une commande précise.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| order_id | INT | NOT NULL, UNIQUE, REFERENCES orders(id) |
| commentaire | TEXT | NULL |
| note_etoile | SMALLINT | NULL, CHECK entre 1 et 5 |
| rempli | BOOLEAN | défaut false |
| created_at | TIMESTAMP | défaut now() |

---

## 9. Sécurité et exploitation (échelle ~100 utilisateurs)

- Rate limiting sur les routes de connexion et de validation de code
- Variables d'environnement pour les secrets (JWT, connexion DB)
- Sauvegardes automatiques de la base
- HTTPS natif via la plateforme d'hébergement

---

## 10. Règles UI/UX

- Cartes arrondies, ombres légères, beaucoup d'espace blanc
- Un seul code couleur partout :
  - **Vert** = actif / confirmé
  - **Orange** = attention / en retard
  - **Rouge** = urgent / expiré / annulé
  - **Gris** = inactif / verrouillé
- Typographie claire et hiérarchisée
- Retour visuel immédiat sur chaque interaction (bouton, case à cocher)
- Navigation admin toujours visible, jamais de repère perdu

---

## 11. Points encore ouverts

- Champ « bonus » — non défini, à préciser plus tard
- Paiement intégré — hors v1, prévu en amélioration future
- Notifications par email/SMS — hors v1
- Statistiques/historique de consommation avancés — hors v1
