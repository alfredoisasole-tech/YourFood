# Spécification finale — Application d'abonnement de repas (v3.1)

> **v3.1** : alignée sur la maquette (`Maquette/`). Les changements par rapport à la v3 sont listés en section 12.

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

| Formule | Prix **par semaine** | Détail |
|---|---|---|
| Formule 1 | 25 000 FC | Viande incluse uniquement le lundi et le vendredi |
| Formule 2 | 35 000 FC | Viande incluse toute la semaine |

Pour plusieurs semaines, on additionne simplement (ex. 8 semaines de Formule 2 = 8 × 35 000 = 280 000 FC).

Paiement hors application en v1 (l'admin constate le paiement, puis crée le compte). Paiement intégré prévu en v2.

---

## 5. Fonctionnalités détaillées

### 5.1 Inscription (100% côté admin)
Formulaire : nom, prénom, numéro de téléphone (**facultatif** ; normalisé avec indicatif pays à la saisie, +243 par défaut), formule, durée, date de début, date de fin (calculée automatiquement), total (prix hebdomadaire × nombre de semaines), champ « bonus » (non encore défini). Le service réel ne démarre qu'à la date de début, même si le lien est transmis avant.

- **Identifiant de connexion** : « prénom nom », sans tenir compte des accents ni de la casse. Il est **unique** : si deux clients auraient le même, l'application prévient l'administratrice, qui ajoute un détail distinctif (ex. une initiale).
- **Un abonnement commence toujours un lundi et se termine toujours un vendredi.** Par défaut, il commence le prochain lundi après la date de paiement ou d'entrée dans le système ; l'administratrice peut choisir un autre lundi (par exemple si le paiement est fait un lundi et que le service doit démarrer le jour même).
- **Durée** : 1 à 3 semaines, ou 1 à 12 mois (**1 mois = 4 semaines**). La date de fin est le vendredi de la dernière semaine.

### 5.2 Code d'activation et lien
Bouton « Créer » → génère :
- Un code à 8 caractères : 2 initiales (nom + prénom) + 6 caractères aléatoires (lettres, chiffres, `-`, `_`, `.`), unique en base.
- Un lien unique encodant les infos du forfait.

Le code et le lien ne servent **qu'à l'activation initiale du compte** (comme un abonnement Spotify) — jamais régénérés à un renouvellement. Le code reste valable indéfiniment jusqu'à sa première utilisation (pas de délai d'expiration).

Trois façons de transmettre l'accès :
- **Lien** contenant le code (placé après le « # » de l'adresse : cette partie n'est jamais envoyée au serveur ; la page la retire de la barre d'adresse dès l'ouverture). Le lien pré-remplit le nom et le code : le client n'a plus qu'à choisir son mot de passe.
- **WhatsApp** : un bouton « Envoyer » ouvre WhatsApp (Web/mobile) avec un message de bienvenue pré-rempli (lien + code). Indisponible si le client n'a pas de numéro de téléphone.
- **QR code** : l'administratrice l'affiche, le client le scanne et arrive sur le même lien (utile en main propre, ou sans numéro de téléphone).

Le code est à usage unique : il est consommé à la création du mot de passe.

### 5.3 Authentification
- Première connexion en deux étapes : (1) identifiant + code, vérifiés sans consommer le code (« Code accepté, bienvenue ») ; (2) création du mot de passe par le client (l'admin ne le connaît jamais). Le code peut être saisi avec ou sans espace (« RN7Q 3M8K »).
- Connexions suivantes : identifiant (« prénom nom ») + mot de passe uniquement.
- Le mot de passe compte **au moins 8 caractères**.
- Mot de passe modifiable librement par le client, stable d'une période à l'autre.
- **Mot de passe oublié** : bouton « Réinitialiser » sur la fiche client → génère un nouveau code à usage unique, envoyé par WhatsApp, même mécanisme que l'activation.
- Sessions via JWT, mots de passe hachés avec bcrypt.
- Le code d'activation sert de deuxième couche de sécurité en plus du mot de passe (accès à l'espace du client).

### 5.4 Catalogue de plats
Liste modifiable par catégorie (Plat / Accompagnement / Viande), potentiellement jusqu'à 12 accompagnements et 3–5 viandes. Ajout/modification/suppression d'items.
- Un plat ne peut pas être supprimé tant qu'il est utilisé sur une offre non verrouillée ; l'historique des jours passés reste intact même après suppression ultérieure.
- Un plat peut être désactivé temporairement (masqué du catalogue actif sans être supprimé, utile pour un plat saisonnier), indépendamment de la règle de suppression ci-dessus.

### 5.5 Publication de l'offre du jour
L'admin sélectionne les options dans le catalogue (pas de texte libre), **autant qu'elle veut dans chaque catégorie, au minimum une par catégorie** (plat, accompagnement, viande). Seuls les plats activés apparaissent. Deux modes de publication :
- **Publier (jour unique, veille pour lendemain)**
- **Publier pour plusieurs jours** : fenêtre avec sélecteur du nombre de jours (limité aux jours ouvrés lundi-vendredi), le même menu est dupliqué sur les jours choisis, chacun restant individuellement modifiable ensuite.

La publication diffuse le menu à tous les clients simultanément.

### 5.6 Menu et commande (client)
3 catégories, 2 options chacune. L'option Viande dépend de la formule. Heure limite indicative **réglable par l'admin pour chaque jour (entre 11h00 et 19h00)** : après cette heure et avant 20h, l'heure s'affiche en rouge (en retard) mais le choix reste possible. 20h = limite absolue, verrouillage total, menu grisé. **Le verrouillage à 20h00 (heure de Kinshasa) est automatique**, sans action de l'administratrice.

### 5.7 Annulation
Le client peut annuler son repas du jour avant 20h, **même s'il n'avait encore rien confirmé** : l'annulation le retire de l'attribution automatique de 20h (section 5.8) et de la préparation. Elle est réversible tant que le menu n'est pas verrouillé : le client peut confirmer un choix à nouveau.

### 5.8 Commande par défaut
Si le client n'a ni choisi ni annulé avant 20h : il reçoit l'option la plus demandée parmi les commandes déjà passées ce jour-là, catégorie par catégorie (ou la première option si aucune commande n'existe encore ; à égalité, la première option du menu). Les commandes annulées ne comptent pas. **La viande n'est attribuée que si la formule du client l'inclut ce jour-là.** Seuls les clients dont l'abonnement couvre ce jour sont concernés. Notification in-app.

### 5.9 Avis et notation
Sous le menu du jour de consommation, une barre de progression (menu → avis → note étoile), proposée en même temps que le menu suivant (le repas du **dernier jour ouvré** : le lundi, celui du vendredi). Facultatif, non bloquant, mais important pour les statistiques admin. Le client peut aussi noter, depuis son historique, un repas passé qui n'a pas encore d'avis.

### 5.10 Notification admin
Toute action du client (commande, modification, annulation, avis) doit être communiquée à l'administratrice. En v1, ceci se fait via l'écran « Suivi du jour », rafraîchi par polling (15–20s) — pas de notification push nécessaire à ce volume.

### 5.11 Cycle de vie et renouvellement
Le client ne voit que le menu du jour actuel (jamais l'historique en clair). À expiration, son interface devient grisée/non cliquable, mais **il peut toujours se connecter** et consulter son historique. L'état d'un abonnement est **calculé à partir de ses dates** : « actif », « bientôt expiré » (10 jours ouvrés restants ou moins) ou « expiré ». Les « jours restants » sont des **jours ouvrés**, aujourd'hui inclus. Renouvellement : depuis la fiche client, l'admin clique sur « Renouveler / prolonger », choisit la nouvelle durée et peut aussi changer la formule — sans régénérer de code ni de lien. La nouvelle période commence **le lundi qui suit la fin de la période en cours** (ou le prochain lundi si l'abonnement est déjà expiré), ou un autre lundi au choix de l'admin ; l'ancienne période reste valable jusqu'à sa fin. L'ancienne période d'abonnement est conservée en historique (pas écrasée), une nouvelle période est créée. Le client se reconnecte normalement (nom + mot de passe), son accès se réactive automatiquement. Le client reste en base indéfiniment (retrouvable sans réinscription), et ses anciens choix restent visibles en permanence, grisés/inactifs.

---

## 6. Interface admin — navigation et écrans

Interface pensée d'abord pour le téléphone : **barre d'onglets en bas** (Accueil, Suivi, Clients, Carte, Menus, Avis) avec un bouton « + » d'actions rapides (ajouter un plat, publier un menu, nouveau client). **Sur ordinateur (≥ 1024 px), elle devient une barre latérale**, mêmes écrans. Style épuré (inspiration Apple). Écrans :
- **Accueil** — bonjour, bandeau de la semaine (jours publiés ou à publier, livraisons prévues), menu de demain à publier avant 20h, pastilles des clients sans choix
- **Clients** — liste (nom, statut coloré actif/bientôt expiré/expiré) → clic = fiche détaillée
- **Suivi du jour** — vue en direct des choix des clients (origine : choisi / automatique / en attente), case « préparé » avec compteur, réglage de l'heure limite du jour ; devient la vue finale verrouillée après 20h
- **Carte** (catalogue) — gestion des plats
- **Menus** (publication) — mise en ligne du menu (simple ou multi-jours), liste des menus à venir, modification
- **Avis** — flux global type discussion (nom, note, commentaire, jour), du plus récent au plus ancien
- **Statistiques** — dashboard graphiques (accessible depuis l'Accueil)
- **Compte** — mot de passe, mode sombre, déconnexion

### Fiche client détaillée
- Bandeau : nom, téléphone, statut, formule, jours restants, bouton Renouveler (action principale), bouton secondaire « Renvoyer le message de bienvenue »
- 3 onglets :
  - **Infos** (dates, bonus)
  - **Historique** (jours passés, statuts, périodes d'abonnement passées)
  - **Avis** (commentaires + note moyenne)

### Dashboard / Statistiques
- En haut : nombre de clients actifs (sur le total), livraisons du jour, note moyenne des avis (sur le nombre d'avis), plat le plus commandé (une tuile pour la semaine, le mois et l'année en cours, et une pour tout l'historique), abonnements à renouveler (bientôt expirés)
- Histogramme des livraisons par jour ouvré du mois (les jours à venir sont des prévisions)
- Totaux par catégorie (Plat / Accompagnement / Viande), barres dynamiques selon le nombre réel d'options présentes, avec les nombres exacts affichés à côté (pas seulement du visuel)
- Bouton « Détail client par client » → écran **Suivi du jour** : liste simple, client par client (pas de regroupement), avec case à cocher pour marquer « préparé » au fur et à mesure — limitée aux clients actifs. Chaque ligne indique si la commande est automatique (par défaut), choisie par le client, ou en attente de choix.
- **Livraisons d'un jour** = clients dont l'abonnement couvre ce jour, moins les annulations.

---

## 7. Interface client — écrans

### Connexion
- Première fois : nom + code à 8 caractères → création du mot de passe
- Connexions suivantes : nom + mot de passe
- États d'erreur : identifiants invalides, abonnement pas encore actif (« débute le [date] »). Un abonnement expiré n'est pas une erreur : le client entre dans une interface grisée.

### Menu du jour
- En-tête avec le jour concerné, 3 catégories en cartes/boutons, heure limite affichée
- Boutons Confirmer / Annuler
- États : normal / en retard (rouge) / verrouillé (grisé après 20h) / commande par défaut reçue / annulée
- Barre de progression facultative (avis + étoile) pour le repas de la veille

### Historique
- Liste des **propres** repas passés du client (triplet choisi par lui, choisi pour lui par défaut, ou annulé), groupés par semaine, avec ses avis. Recherche par nom de plat et filtre par dates. En lecture seule (grisé) ; seul l'avis d'un repas qui n'en a pas encore peut être ajouté. Le client ne voit jamais les menus d'autres jours.

### Compte
- Changer son mot de passe, mode sombre, se déconnecter

---

## 8. Modèle de données

### users
Identité de connexion, admin ou client. Une seule ligne par personne, indépendante des abonnements.

| Champ | Type | Contrainte |
|---|---|---|
| id | SERIAL | PRIMARY KEY |
| nom | VARCHAR | NOT NULL |
| prenom | VARCHAR | NOT NULL |
| telephone | VARCHAR | **NULL autorisé** (facultatif), UNIQUE, normalisé avec indicatif pays |
| login_key | VARCHAR | NOT NULL, UNIQUE — « prénom nom » sans accents ni majuscules (identifiant de connexion) |
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
| statut | ENUM('actif','expire') | NOT NULL, défaut 'actif' — **indicatif** : l'état affiché est toujours calculé à partir des dates |
| created_at | TIMESTAMP | défaut now() |

*date_debut est toujours un lundi et date_fin un vendredi. Les périodes d'un même client ne se chevauchent pas (contrôlé en application).*

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
| supprime | BOOLEAN | défaut false — true = retiré de la carte mais conservé pour l'historique des jours passés |
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
| plat_id | INT | REFERENCES offer_options(id) — NULL uniquement si statut = annulee |
| accompagnement_id | INT | REFERENCES offer_options(id) — NULL uniquement si statut = annulee |
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
- Mode sombre (client et admin), interrupteur dans « Compte »

---

## 11. Points encore ouverts

- Champ « bonus » — non défini, à préciser plus tard
- Paiement intégré — hors v1, prévu en amélioration future
- Notifications par email/SMS — hors v1
- Statistiques/historique de consommation avancés — hors v1

---

## 12. Changements de la v3.1 (par rapport à la v3)

| Sujet | v3 | v3.1 |
|---|---|---|
| Prix | « Prix » sans période | Prix **par semaine**, additionnés sur la durée |
| Début / fin d'abonnement | Non précisés | Toujours du **lundi au vendredi** ; durée en semaines ou mois (1 mois = 4 semaines) |
| Jours restants | Non précisés | **Jours ouvrés**, aujourd'hui inclus ; « bientôt expiré » à 10 jours ouvrés ou moins |
| Téléphone | Obligatoire | **Facultatif** (lien et QR code remis en main propre si absent) |
| Identifiant | « nom » | **« prénom nom »**, unique |
| Lien d'activation | Lien seul + code séparé | Lien contenant le code (après le « # »), envoi WhatsApp, **QR code** |
| Mot de passe | Non précisé | 8 caractères minimum |
| Options par catégorie | Exactement 2 | **Libre**, au moins une par catégorie |
| Heure limite indicative | Configurable | Réglable **par jour**, entre 11h00 et 19h00 |
| Verrouillage 20h | Non précisé | **Automatique** |
| Annulation | Sur une commande existante | Possible **sans commande préalable**, réversible avant 20h |
| Commande par défaut | Option la plus demandée | Idem, **annulations exclues, viande selon la formule, abonnements en cours uniquement** |
| Abonnement expiré | Interface grisée | Idem, **connexion possible**, historique consultable |
| Renouvellement | Nouvelle période | Commence **le lundi suivant** la fin de la période en cours |
| Navigation admin | Barre latérale | Onglets sur mobile, barre latérale sur ordinateur ; écrans Accueil et Compte ajoutés |
| Statistiques | Clients actifs, livraisons, catégories | + note moyenne, plat le plus commandé (semaine, mois, année, historique), à renouveler, histogramme mensuel |
| Case « préparé » | Dans le détail des statistiques | Dans **Suivi du jour** |
| Historique client | Lecture seule | + recherche par plat, filtre par dates, avis a posteriori |
| Suppression d'un plat | Bloquée si sur une offre non verrouillée | Idem ; un plat déjà servi est **archivé** (historique intact) |
| Mode sombre | — | Client et admin |
