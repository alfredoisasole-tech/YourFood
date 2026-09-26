# SPEC.md — Spécification fonctionnelle complète

## Application d'abonnement de repas (v2)

---

## 1. Contexte

Une administratrice possède un business de restauration et livre de la nourriture du lundi au vendredi. L'application permet aux clients (environ une centaine à terme) de s'abonner et de commander leurs plats selon les offres journalières, avec une inscription entièrement gérée par l'administratrice (pas d'auto-inscription libre).

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
| Graphiques admin | Recharts | Dashboard (répartition des choix, suivi des commandes) |
| Génération de code | crypto (natif Node) | Code d'accès à 8 caractères |
| Sécurité | express-rate-limit | Protection des routes de connexion / code contre le brute-force |

Architecture volontairement simple : un seul serveur Node, une seule base PostgreSQL, pas de microservices, pas de cache, pas de file de messages. Le temps réel (Socket.io) est optionnel et non nécessaire au lancement — un polling toutes les 15–20 secondes sur le dashboard admin suffit à ce volume.

Hébergement conseillé : backend + PostgreSQL sur Railway ou Render (déploiement via GitHub, sauvegardes automatiques incluses) ; frontend React sur Vercel ou Netlify.

---

## 3. Rôles

### Administrateur

- Inscrit les clients et gère leurs forfaits
- Génère les codes d'accès et liens uniques
- Publie l'offre du jour
- Consulte le récapitulatif de préparation et le dashboard (graphiques)
- Reçoit toute action client (commande, modification, annulation, avis) via son dashboard

### Client

- Accède à son espace uniquement via le lien fourni par l'admin
- Consulte l'offre du jour et fait ses choix
- Peut modifier ou annuler sa commande jusqu'à l'heure limite
- Peut laisser un avis et une note en fin de journée (facultatif)

---

## 4. Formules d'abonnement

| Formule | Prix | Détail |
|---|---|---|
| Formule 1 | 25 000 FC | Viande incluse uniquement le lundi et le vendredi |
| Formule 2 | 35 000 FC | Viande incluse toute la semaine |

Le paiement se fait hors application en v1 (l'admin constate le paiement, puis crée le compte). La gestion du paiement intégré est prévue en amélioration future.

---

## 5. Fonctionnalités détaillées

### 5.1 Inscription (100% côté admin)

Le client ne peut pas s'inscrire lui-même. L'administratrice saisit : nom, prénom, formule, durée payée, date de début (la date de fin est calculée automatiquement), et un champ « bonus » (non encore spécifié — à définir avec l'admin). Le service réel ne démarre qu'à la date de début choisie, même si le lien est transmis avant cette date.

### 5.2 Génération du code et du lien

Un bouton « Créer », en bas de la page d'inscription, génère :

- **Un code à 8 caractères** : les 2 premiers sont les initiales du nom et prénom du client ; les 6 suivants sont générés aléatoirement (lettres, chiffres, et caractères spéciaux restreints à `-`, `_`, `.` pour rester compatibles avec une URL sans encodage). Un élément varie à chaque génération pour garantir un code différent à chaque renouvellement, tout en restant unique en base (vérification d'unicité avant validation).
- **Un lien unique** encodant les informations du forfait, que l'admin transmet elle-même au client (SMS, WhatsApp, etc.).
- Prévoir un bouton « copier le code » pour éviter la saisie manuelle.

Le code reste valable toute la durée du forfait payé.

### 5.3 Authentification

- **Première connexion** : nom + code à 8 caractères (saisi une seule fois), puis le client crée lui-même son mot de passe (l'admin ne le connaît jamais).
- **Connexions suivantes** : nom + mot de passe uniquement.
- Le mot de passe est modifiable librement par le client tant que son abonnement est actif, et reste identique d'une période à l'autre (pas de redéfinition obligatoire au renouvellement).
- Sessions gérées par JWT ; mots de passe hachés avec bcrypt.

### 5.4 Offre journalière

Chaque jour, l'offre concerne la livraison du lendemain et comprend 3 catégories, chacune avec 2 options : **Plat**, **Accompagnement**, **Viande**. Le client choisit une option par catégorie (triplet). L'option « Viande » est limitée selon la formule (lundi/vendredi uniquement pour la formule 25 000 FC, tous les jours pour la formule 35 000 FC).

### 5.5 Heure limite

L'admin configure une heure limite indicative par jour. Après cette heure et jusqu'à 20h (limite absolue et non modifiable), le choix du client reste possible mais s'affiche en rouge dans l'interface pour signaler le retard. À partir de 20h, le menu du jour se grise et se verrouille : plus aucune modification possible.

### 5.6 Annulation

Le client peut annuler sa commande du jour avant l'heure limite absolue. Une commande annulée est exclue du récapitulatif de préparation.

### 5.7 Gestion du non-choix (commande par défaut)

Si un client n'a pas commandé avant le verrouillage : il reçoit automatiquement, pour chaque catégorie, l'option la plus demandée parmi les commandes déjà passées ce jour-là (ou la première option de chaque catégorie si aucune commande n'existe encore). Le client est notifié in-app du détail de sa commande par défaut.

### 5.8 Avis et notation

Sous le menu du jour de consommation, une barre de progression avec trois étapes (menu → avis → note par étoile) est proposée au client en même temps que le menu suivant. C'est facultatif, non bloquant, mais mis en avant car les données alimentent les statistiques du dashboard admin.

### 5.9 Cycle de vie / expiration

Le client ne voit jamais l'historique des jours passés en clair — uniquement le menu du jour actuel. Une fois son abonnement expiré, toute son interface devient grisée et non cliquable jusqu'à ce que l'admin génère un nouveau lien. Il peut alors revoir ses choix passés, mais affichés en grisé/inactif en permanence, toujours cohérents avec ce que voit l'admin. Le client reste enregistré en base indéfiniment pour être retrouvé sans devoir être réinscrit.

### 5.10 Notification admin

Toute action du client (commande, modification, annulation, avis) doit remonter au dashboard admin. En v1 : rafraîchissement par polling (15–20 secondes). Passage possible à du temps réel (Socket.io) en amélioration future si le besoin se confirme.

---

## 6. Dashboard admin

- **Récapitulatif de préparation** (après verrouillage) : total par catégorie (quantités à préparer) + liste détaillée par client (triplet exact de choix, pour la livraison individualisée).
- **Graphiques** (Recharts) : répartition des plats/accompagnements/viandes choisis, suivi des commandes passées / par défaut / annulées.
- **Fiche client** : durée restante, choix (y compris finaux), historique personnel, notes de satisfaction, commentaires.

---

## 7. Modèle de données (proposition)

```
users
  id, nom, prénom, mot_de_passe_hash, rôle (admin/client)

subscriptions
  id, user_id, formule (25000/35000), date_debut, date_fin (auto),
  bonus (à définir), statut (actif/expiré)

access_codes
  id, subscription_id, code (8 caractères), date_génération,
  première_connexion_faite (bool)

daily_offers
  id, date, heure_limite_indicative, statut (ouvert/verrouillé)
  -- heure limite absolue fixée à 20h, non stockée par jour

offer_options
  id, daily_offer_id, catégorie (plat/accompagnement/viande), nom

orders
  id, daily_offer_id, subscription_id, plat_choisi_id,
  accompagnement_choisi_id, viande_choisie_id,
  statut (en_attente/verrouillée/annulée), est_défaut (bool),
  créée_le, modifiée_le

reviews
  id, order_id, commentaire, note_étoile, rempli (bool)
```

---

## 8. Processus de verrouillage (à l'heure limite absolue — 20h)

1. Identifier les clients n'ayant pas encore commandé.
2. Pour chaque catégorie, calculer l'option la plus demandée parmi les commandes déjà passées (ou appliquer la première option si aucune commande n'existe).
3. Créer/compléter la commande de ces clients avec ces valeurs (`est_défaut = true`).
4. Envoyer une notification in-app à ces clients.
5. Passer le statut de `daily_offers` à « verrouillé ».

Implémentation simple : pas besoin d'un cron séparé — chaque requête sur l'offre du jour peut vérifier `now() > 20h` et déclencher ce processus à la volée si ce n'est pas déjà fait.

---

## 9. Écrans à prévoir

### Côté client

1. **Connexion** (première fois : nom + code + création mot de passe ; ensuite : nom + mot de passe)
2. **Écran du jour** : 3 catégories × 2 options, boutons simples, confirmation, annulation, barre de progression avis/note
3. **Vue historique** (grisée, lecture seule)

### Côté admin

1. **Inscription client** + génération du code/lien (une seule page)
2. **Publication de l'offre du jour** (saisie des 6 options + heure limite indicative)
3. **Récapitulatif post-verrouillage** (imprimable/exportable)
4. **Dashboard graphiques** + fiche client détaillée

---

## 10. Sécurité et exploitation (échelle ~100 utilisateurs)

- Rate limiting (`express-rate-limit`) sur les routes de connexion et de validation du code
- Variables d'environnement pour les secrets (JWT, connexion DB) — jamais en dur dans le code
- Sauvegardes automatiques de la base (natif sur Railway/Render)
- HTTPS natif via la plateforme d'hébergement

---

## 11. Améliorations futures (hors v1)

- Paiement intégré à l'abonnement
- Notifications par email/SMS en plus de l'in-app
- Historique et statistiques de consommation par client
- Passage en temps réel (Socket.io) si le besoin se confirme
