# Plan d'intégration de la maquette — YourFood

Document de travail pour les deux développeurs. Il compare la maquette (`Maquette/`) à `SPEC.md` (v3, source de vérité) et au backend déjà écrit, liste les écarts avec une proposition à chaque fois, puis découpe le travail en phases.

> **État au 30 septembre 2026 :** toutes les phases sont réalisées (backend, frontend client et admin selon la maquette, mode sombre, tests, README). Les sections 3 à 6 restent l'analyse de départ ; quand elles divergent de la section 0, c'est la section 0 qui fait foi.

---

## 0. Décisions validées

| Sujet | Décision |
|---|---|
| Navigation admin (A1) | Onglets en bas sur mobile, barre latérale dès 1024 px |
| Options par catégorie (A2) | **Libre**, comme la maquette : au moins un plat, un accompagnement et une viande |
| Heure limite (A3) | Seul le réglage de l'heure du jour en v1 (11h00 à 19h00). Limites par client, prolongation groupée, relance groupée, interrupteur « choix automatique » : hors v1 |
| Prix (A9) | Prix **hebdomadaires**, additionnés sur plusieurs semaines |
| Durée et début (A10) | Un abonnement commence toujours un **lundi** (par défaut le prochain, ou un autre lundi au choix de l'admin, y compris le jour même si c'est un lundi) et finit un **vendredi**. Durée en semaines ; **1 mois = 4 semaines** |
| Jours restants (A11) | Jours ouvrés, aujourd'hui inclus |
| « Bientôt expiré » (A12) | 10 jours ouvrés restants ou moins (constante `EXPIRING_SOON_WORKING_DAYS`) |
| Autres ajouts de la maquette (A4 à A8) | Implémentés tels quels : statistiques enrichies, case « préparé » dans Suivi, mode sombre, pages Compte, historique avec recherche, filtre et avis a posteriori |
| Identifiant (B1) | « Prénom Nom », unique (`login_key`). « Nom Prénom » est aussi accepté à la saisie |
| Verrouillage 20h (B5) | Automatique (tâche planifiée + à la lecture) |
| Attribution par défaut (B5b/c) | Corrigée : annulations respectées, abonnements couvrant le jour uniquement, viande selon la formule |
| Abonnement expiré (B3) | On suit la SPEC : connexion possible, interface grisée, historique visible |
| Renouvellement (B4) | La période en cours reste valable ; la nouvelle commence le lundi suivant |
| Lien d'activation (B2) | Lien contenant le code **après le « # »** (jamais envoyé au serveur), envoi WhatsApp, **QR code**. Le jeton de lien séparé prévu au départ n'est plus nécessaire |
| Annuler sans commande (B6) | L'annulation est enregistrée même sans choix préalable (plat et accompagnement facultatifs sur une commande annulée) : le client n'est plus servi par défaut. Réversible avant 20h |
| Téléphone | **Facultatif** ; sans numéro, l'admin remet le lien ou le QR code en main propre |
| Pastilles « MK · PM · JT · +9 » de l'accueil admin | Initiales (première lettre du prénom et du nom) de clients ; affichées comme les clients sans choix aujourd'hui, le reste en « +N » : groupe à confirmer à l'intégration |
| Plat le plus commandé (statistiques) | Quatre valeurs : semaine, mois, année en cours et historique général |
| Migrations | Exécutées et vérifiées sur PostgreSQL (le schéma correspond exactement à la base) |

---

## 1. Ce qui a été analysé

Les deux fichiers HTML de `Maquette/` sont des bundles compressés : on les a décompressés pour lire les textes, les états et la logique de chaque écran (les PDF ne montrent que l'image).

| Fichier | Écrans | Détail |
|---|---|---|
| Espace client | 18 | 14 écrans réels + 4 variantes mode sombre. Format mobile 390×844 |
| Espace admin | 52 | 26 écrans réels + 26 variantes mode sombre. Format mobile 390×844 |

Identité visuelle relevée : polices **DM Sans** (texte) et **Instrument Serif italique** (titres), vert principal `#1F7A4D`, fond crème `#FAF9F5`, cartes très arrondies, photo d'accueil + logo « Your Food » (fichiers à extraire de la maquette : `Maquette/*.html` contient les images et polices en base64).

---

## 2. Inventaire des écrans et routes proposées

### Espace client (mobile-first, barre d'onglets : Menu · Historique · Compte)

| Écran maquette | Route | API nécessaire | État backend |
|---|---|---|---|
| Bienvenue | `/` | — | — |
| Connexion (+ erreur identifiants, + abonnement pas encore actif) | `/connexion` | `POST /auth/login` | existe, à corriger (B1, B3) |
| Première connexion (nom + code) | `/premiere-connexion` | vérification du code | **manque** (B2) |
| Créer le mot de passe | `/creer-mot-de-passe` | `POST /auth/first-login` | existe |
| Lien WhatsApp | `/bienvenue/:token` | lecture du lien | **manque** (B2) |
| Menu du jour, **6 états** : normal · en retard · verrouillé · commande par défaut · annulée · abonnement expiré | `/menu` | `GET /offers/today`, `POST /orders`, `POST /orders/:id/cancel`, `POST /reviews` | existe, à corriger (B3, B5, B6, B7) |
| Historique (recherche par plat, filtre par dates, noter un repas) | `/historique` | historique client | **manque** (B8) |
| Mon compte (mot de passe, mode sombre, déconnexion) | `/compte` | `PUT /auth/change-password` | existe |

### Espace admin (mobile-first, barre d'onglets : Accueil · Suivi · Clients · Carte · Menus · Avis, bouton « + » d'actions rapides)

| Écran maquette | Route | API nécessaire | État backend |
|---|---|---|---|
| Connexion admin | `/admin/connexion` | `POST /auth/login` | existe |
| Accueil (bandeau de la semaine, menu de demain, livraisons) | `/admin` | offres à venir | **manque** (B8) |
| Statistiques | `/admin/statistiques` | agrégats | **manque** (B8) |
| Suivi du jour (3 états : ouvert · heure limite · verrouillé) | `/admin/suivi` | `GET /admin/orders/live`, `PATCH` préparé | existe, à enrichir |
| Clients (liste, filtres, recherche) | `/admin/clients` | liste enrichie | à enrichir (B8) |
| Nouveau client → accès créé (code, lien, WhatsApp) | `/admin/clients/nouveau` | `POST /admin/clients` | existe, à corriger (A10, B2) |
| Fiche client (onglets Infos · Historique · Avis) | `/admin/clients/:id` | `GET /admin/clients/:id` | existe, à corriger (A10) |
| Renouvellement | fenêtre sur la fiche | `POST …/renew` | existe, à corriger (B4) |
| Carte des plats (ajouter, modifier, supprimer, suppression bloquée) | `/admin/carte` | `/admin/catalog` | existe, à compléter |
| Menus (publier, multi-jours, modifier un menu à venir) | `/admin/menus` | `/admin/offers/*` | à compléter (A2, B8) |
| Avis | `/admin/avis` | `GET /admin/reviews` | existe |
| Compte administrateur | `/admin/compte` | — | — |

---

## 3. Écarts maquette ↔ SPEC (décisions produit)

| # | Écart | Maquette | SPEC | Proposition |
|---|---|---|---|---|
| A1 ⚠️ | Navigation admin | Barre d'onglets en bas + bouton « + » (mobile) | Barre latérale (§6) | Garder la maquette sur téléphone et passer en **barre latérale dès 1024 px**, mêmes routes. La SPEC est respectée sur ordinateur. |
| A2 ⚠️ | Nombre d'options par catégorie | « Coche autant de plats que tu veux » (ex. 4 plats, 7 accompagnements proposés, 2 cochés par défaut) | Exactement 2 par catégorie (§5.5) ; le backend refuse tout ce qui n'est pas 6 items | Autoriser **1 à N** par catégorie (le menu client gère déjà N options). Mettre la SPEC à jour et assouplir la validation backend. |
| A3 ⚠️ | Heure limite (fenêtre dans « Suivi ») | Réglage de l'heure du jour, **limites personnalisées par client**, « Prolonger d'une heure pour tous », « Relancer les 12 clients sans choix », interrupteur « choix automatique » | Une seule heure indicative configurable (§5.6) ; attribution automatique toujours active (§5.8) | **V1 : uniquement le réglage de l'heure du jour.** Reste hors SPEC : à reporter en v1.1. Notamment l'interrupteur « choix automatique » contredit §5.8 (à retirer), et la relance groupée par WhatsApp n'est pas possible sans API WhatsApp Business (on ne peut ouvrir qu'un `wa.me` à la fois). |
| A4 | Statistiques | Tuiles Clients / Avis (4,6 sur 48) / Plat le plus commandé / À renouveler ; histogramme des livraisons du mois avec prévisions ; un sélecteur de catégorie (une à la fois) | Clients actifs, livraisons du jour, un graphique par catégorie (§6) ; « stats avancées » hors v1 (§11) | Reprendre la maquette : ce sont des agrégats simples. Garder les **nombres exacts affichés** (§6) et afficher les 3 catégories sur grand écran. |
| A5 | Case « préparé » | Dans **Suivi du jour** (filtres Tous / À préparer / Préparés / En attente, compteur « x préparés sur 93 ») | Dans le bouton « Détail » du dashboard (§6) | Implémenter dans Suivi (page opérationnelle) ; le « Détail client par client » des Statistiques renvoie vers Suivi. |
| A6 | Mode sombre (client + admin) | Présent sur tous les écrans | Non prévu (§10) | Le faire en **dernière phase**, via variables CSS, avec interrupteur dans « Compte ». Non bloquant. |
| A7 | Pages « Mon compte » et « Compte administrateur » | Présentes | Non listées | Accepter : contient le changement de mot de passe (§5.3) et la déconnexion. |
| A8 | Historique client | Recherche par plat, filtre par dates, et **noter un repas passé** | « Lecture seule, grisé » (§7) ; §5.11 dit à la fois « jamais l'historique en clair » et « anciens choix visibles en permanence » | La SPEC se contredit. On retient : le client voit **ses propres choix passés** (jamais les menus d'autres jours), et peut laisser un avis sur un repas passé qui n'en a pas (l'avis reste facultatif, §5.9). |
| A9 ⚠️ | **Prix par semaine** | 25 000 / 35 000 FC **par semaine**, total = prix × nb de semaines (280 000 FC pour 8 semaines) | Juste « Prix » sans période (§4) | **À confirmer avec l'administratrice** : par semaine, par mois ou forfait ? Impacte le « Total » affiché. |
| A10 ⚠️ | Durée et date de fin | Durées : 1 à 3 semaines ou 1 à 12 mois ; la fin tombe toujours un **vendredi** ; début proposé = prochain lundi, avertissement si week-end | Durée non précisée ; le backend prend un nombre de **jours calendaires** (1 à 365) | Faire calculer la date de fin par le backend avec la règle de la maquette, dans une fonction partagée (`packages/shared`) utilisée aussi par le formulaire. |
| A11 | « Jours restants » | 24 jours restants du 29 sept. au 30 oct. → ce sont des **jours ouvrés** | Non précisé ; backend = jours calendaires (31) | Compter en jours ouvrés (= nombre de livraisons restantes). |
| A12 ⚠️ | Statut « bientôt expiré » | 9 jours restants = bientôt expiré ; 19 = actif | Pas de seuil (§6) | Seuil proposé : **≤ 10 jours ouvrés**, constante unique. À valider. |
| A13 | Couleurs « en retard » | Heure limite en rouge, barre de progression en orange | §5.6 : rouge ; §10 : orange | Petite contradiction interne de la SPEC. La maquette combine les deux : on la suit. |
| A14 | Téléphone | Préfixe +243 figé | « Indicatif pays » (§5.1) | Champ avec +243 par défaut et possibilité de changer. |
| A15 | Bonus | Champ « À définir » | Non défini (§11) | Champ texte libre, comme prévu. |

---

## 4. Écarts maquette ↔ backend actuel (travail de développement)

Certains points sont de vrais bogues, indépendants de la maquette.

| # | Sujet | Constat dans le code | Proposition |
|---|---|---|---|
| B1 ⚠️ | **Connexion par nom seul** | `findByNom` fait un `findFirst` : deux clients avec le même nom → mauvais compte, sans erreur. La maquette contient d'ailleurs **Kalala** (Deborah, Freddy) et **Kasongo** (Joël, Jonathan). | Identifiant = **prénom + nom** (« Amani Mukendi »), comparé sans accents ni casse, **unique** à la création (l'admin est prévenue en cas de doublon). Demande une migration (index unique). |
| B2 | Première connexion et lien | La maquette a deux étapes (« Code accepté, bienvenue » puis mot de passe) ; le backend fait tout en un appel. Le lien actuel `/activation?code=…&nom=…` **met le code dans l'URL**, ce qui annule la « deuxième couche de sécurité » (§5.3). La maquette utilise `yourfood.app/bienvenue/x7k2p9`. | Ajouter `POST /auth/verify-code` (ne consomme pas le code) et un **jeton de lien** court (`lien_token` sur `access_codes`, migration). Le lien pré-remplit le nom, jamais le code. |
| B3 | **Abonnement expiré** | `login` refuse (403) tout client sans abonnement `actif`. La SPEC (§5.11) et la maquette veulent un accès grisé avec historique. Personne ne passe non plus `statut` à `expire` quand la date passe. | Calculer l'état **à partir des dates** (`non commencé` / `actif` / `bientôt expiré` / `expiré`). `login` réussit pour un client expiré et renvoie l'état ; seul « pas encore commencé » reste une erreur (écran maquette n° 6). |
| B4 | **Renouvellement** | Le renouvellement passe l'ancienne période en `expire` **tout de suite** et crée la nouvelle avec un début futur → le client est bloqué jusqu'à cette date. Début = fin + 1 jour calendaire (peut tomber un samedi). | Garder l'ancienne période active jusqu'à sa fin ; nouvelle période qui démarre le **prochain jour ouvré** (maquette : fin 30 oct. → début 2 nov.). |
| B5 | **Verrouillage à 20h** | `lockAndAssignDefaults` n'est appelée que par une route admin manuelle ; le commentaire annonce un déclenchement automatique, mais je n'en ai trouvé aucun. | Déclenchement **automatique** : à la lecture (menu client, suivi admin) si 20h passée + tâche planifiée à 20h00 (Kinshasa). Opération idempotente. |
| B5b | Bogues dans l'attribution par défaut | (i) Un client qui a **annulé** est traité comme « sans commande » → tentative de créer une 2ᵉ commande → **erreur d'unicité**. (ii) Tous les abonnements `actif` reçoivent une commande, même **pas commencés ou finis**. (iii) La viande par défaut est donnée même à la **Formule 1 hors lundi/vendredi**. | Corriger les trois, avec tests. |
| B5c | Règle viande non appliquée | `isMeatAllowed` sert à l'affichage mais `submitOrder` accepte une viande pour un client Formule 1 un mardi ; l'abonnement n'est pas non plus vérifié (dates). | Valider côté serveur : abonnement en cours + viande autorisée. |
| B6 ⚠️ | **Annuler sans avoir commandé** | La maquette permet « Annuler mon repas » depuis un menu vierge. Le backend exige une commande existante, et `plat_id` / `accompagnement_id` sont `NOT NULL`. | Rendre ces deux colonnes **nullables** quand la commande est annulée (migration) et faire de l'annulation un « créer ou mettre à jour ». Question liée : peut-on **reprendre** son repas avant 20h après annulation ? (le backend le permet ; la maquette non). |
| B7 | Avis « repas de la veille » | Le backend cherche le jour calendaire d'hier : le lundi, rien (dimanche). | Prendre le **dernier jour ouvré** livré. |
| B8 | **Endpoints manquants** | Pas de `GET /auth/me` ; pas d'historique client (filtre dates + recherche plat) ; `GET /admin/clients` renvoie des `User` sans abonnement/état/jours restants/recherche/compteurs par filtre ; pas de liste des offres à venir ni de modification d'un menu ; pas de statistiques ; pas de « renvoyer le message de bienvenue » ; la modification d'un plat ne permet pas de changer la **catégorie** (la maquette le propose) ; l'erreur « suppression bloquée » doit dire **quel menu** (date) utilise le plat. | À ajouter (liste détaillée en phase 1). |
| B9 | Mot de passe | Maquette : « Au moins 8 caractères » ; `passwordSchema` : minimum 6. | Passer à 8. |
| B10 | Messages WhatsApp | Le texte du backend diffère de celui de la maquette (« Bienvenue à table chez Your Food ! Dès le lundi 5 octobre… »). Le code s'affiche `RN7Q 3M8K` (avec espace). | Aligner les textes ; **retirer les espaces** avant validation du code. |
| B11 | Assets et polices | Logo, photo (373 Ko), polices dans le HTML de la maquette. | Extraire vers `apps/frontend/public/`, compresser la photo, servir les polices en local. |

---

## 5. Décisions à prendre avant de coder

Les six qui bloquent le plus, avec ma recommandation :

1. **A9 : prix par semaine ?** À demander à l'administratrice. Rien de grave si on se trompe, seul le « Total » affiché change.
2. **B1 : identifiant de connexion.** Recommandé : « prénom + nom », unique.
3. **A2 : nombre d'options par catégorie.** Recommandé : variable (1 à N).
4. **A3 : fonctions de l'heure limite.** Recommandé : réglage du jour seulement en v1.
5. **B6 : annulation sans commande.** Recommandé : colonnes nullables (migration).
6. **A1 : navigation admin.** Recommandé : onglets sur mobile, barre latérale sur ordinateur.

Deux questions de compréhension sur la maquette :
- Que représentent les pastilles **« MK · PM · JT · +9 »** en haut de l'Accueil admin ? (je suppose les 12 clients sans choix)
- Après **annulation**, le client peut-il **reprendre** son repas avant 20h ?

Les points ⚠️ B1, B2 et B6 modifient la base de données : conformément à `CLAUDE.md`, je te demande ton accord avant d'écrire les migrations.

---

## 6. Plan d'exécution

Chaque phase = une branche + une PR vers `dev`, commits petits (`feat(frontend): …`). L'ordre garantit qu'on ne construit jamais un écran sur une API qui n'existe pas.

### Phase 0 : Décisions et SPEC — ✅ réalisée (SPEC v3.1)
- Trancher la section 5, mettre à jour `SPEC.md` (v3.1) : options variables, historique client, jours ouvrés, seuil « bientôt expiré », règle de fin de période.
- Corriger la contradiction §5.11 / §7.

### Phase 1 : Socle backend (correctifs + endpoints) — ✅ réalisée

> Migrations écrites à la main (Docker éteint) et **non encore exécutées** sur une base. Tests unitaires : 101 passent ; tests d'intégration avec base à ajouter.
1. Fonctions partagées dans `packages/shared` : `computeSubscriptionEnd`, `countWorkingDays`, `getSubscriptionState`.
2. Corriger B1 à B7 et B9 (avec tests unitaires et d'intégration des services : commandes, verrouillage, renouvellement, abonnement).
3. Nouveaux endpoints :
   - `GET /auth/me`, `POST /auth/verify-code`, `GET /auth/activation-link/:token`
   - `GET /client/history?from&to&q`
   - `GET /admin/clients?q&etat` (état, jours restants, compteurs), `POST /admin/clients/:id/resend-welcome`
   - `GET /admin/offers?from&to`, `PUT /admin/offers/:date`, `PATCH /admin/offers/:date` (heure limite)
   - `GET /admin/stats/overview`, `GET /admin/stats/deliveries?month`
   - catalogue : `categorie` modifiable, 409 avec la date du menu bloquant
4. Étendre `GET /admin/orders/live` : origine de chaque ligne (choisi / automatique / en attente), clients sans choix.

### Phase 2 : Socle frontend
- Thème Tailwind (couleurs, polices, rayons, ombres) tiré de la maquette + règles de couleur de la SPEC §10.
- Assets et polices (B11), `AuthContext`, gardes de route par rôle, client API avec le JWT, gestion des erreurs.
- Bibliothèque de composants partagés : bouton, puce, badge d'état, interrupteur, liste déroulante, **fenêtre glissante du bas** (utilisée partout côté admin), sélecteur de plage de dates, avatar à initiales, barre d'onglets.

### Phase 3 : Espace client (dev A)
1. Bienvenue → Connexion (+ erreurs) → Première connexion → Créer le mot de passe → `/bienvenue/:token`.
2. **Menu du jour** : composant « pile de cartes » (3 catégories), compte à rebours, et les 6 états (normal, en retard, verrouillé, défaut, annulé, expiré) pilotés par la réponse de l'API. Formule 1 : carte viande « Pas aujourd'hui ».
3. Avis (barre Menu → Avis → Note, étoiles).
4. Historique (recherche, filtre de dates, notation a posteriori) puis Compte.

### Phase 4 : Espace admin, partie 1 (dev B)
1. Connexion admin, coque de navigation (onglets / barre latérale, bouton « + »).
2. Clients : liste + filtres + recherche, **Nouveau client** (dates, durée, total, code + lien), envoi WhatsApp, fiche à 3 onglets, renouvellement, réinitialisation du mot de passe.
3. Carte des plats : liste par catégorie, ajout, modification, désactivation, suppression avec cas « bloquée ».

### Phase 5 : Espace admin, partie 2
1. Menus : publication simple et multi-jours, liste des menus à venir, modification.
2. Suivi du jour : rafraîchissement automatique (15 à 20 s, « Actualisé il y a x s »), filtres, case « préparé », fenêtre « Heure limite », état verrouillé.
3. Accueil (bandeau de la semaine), Statistiques (tuiles, histogramme, totaux par catégorie), Avis (groupés par période), Compte.

### Phase 6 : Finitions
- Mode sombre (A6), accessibilité (contrastes, focus, libellés), tests frontend de base (Vitest + Testing Library) sur les parcours critiques : connexion, commande, annulation, création de client.
- README complet (setup, scripts, comptes de test du seed), mise à jour de `CLAUDE.md`.

### Répartition suggérée à deux
- **Toi / dev A** : phases 2 (composants), 3.
- **Ton pote / dev B** : phase 1 (backend), puis 4 et 5.
- Points de synchronisation : fin de phase 1 (contrat d'API figé dans `packages/shared`) et fin de phase 2 (composants partagés).

---

## 7. Hors périmètre v1 (à garder en tête)
Limites personnalisées par client, prolongation groupée, relance groupée (nécessite l'API WhatsApp Business), notifications push, paiement intégré (SPEC §11).
