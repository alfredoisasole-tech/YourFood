# Déploiement — Supabase + Render + Vercel

Trois services, chacun à sa place :

| Service | Rôle | Ce qu'il héberge |
|---|---|---|
| **Supabase** | Base de données | PostgreSQL uniquement (pas son API, pas son authentification) |
| **Render** | API | Le backend Node/Express, le verrouillage de 20h |
| **Vercel** | Site | Le frontend React (clients et administratrice) |

```
Téléphone ──► Vercel (site)  ──► Render (API) ──► Supabase (base)
              https://…vercel.app   https://…onrender.com/api
```

**Ordre à suivre** (chaque étape donne une adresse à l'étape suivante) :
0. Le code sur GitHub · 1. Supabase · 2. Render · 3. Vercel · 4. Relier Render à Vercel · 5. Créer le compte administratrice · 6. Vérifier

Prévois environ une heure. Note les valeurs au fur et à mesure dans un gestionnaire de mots de passe : **ne les colle jamais dans le dépôt ni dans une conversation**.

---

## 0. Le code sur GitHub

Render et Vercel déploient depuis la branche **`main`** du dépôt `alfredoisasole-tech/YourFood`.

1. Pousse `dev` : `git push origin dev`.
2. Ouvre une Pull Request `dev` → `main` sur GitHub et fusionne-la (le merge vers `main` est réservé au propriétaire du dépôt, voir `CONTRIBUTING.md`).

> Pour un premier essai sans toucher à `main`, tu peux choisir la branche `dev` dans les réglages de Render et de Vercel, puis revenir sur `main` ensuite.

---

## 1. Supabase — la base de données

1. **New project**. Choisis :
   - **Region** : *Europe (Frankfurt)* — la même que Render.
   - **Database password** : génère un mot de passe **long, avec seulement des lettres et des chiffres** (les symboles comme `@`, `#` ou `/` cassent l'adresse de connexion). Garde-le.
2. Attends la fin de la création (1 à 2 minutes).
3. Clique sur **Connect** (en haut de la page du projet) → onglet **ORMs / Session pooler** et copie l'adresse **Session pooler**. Elle ressemble à :

   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

4. Remplace `[YOUR-PASSWORD]` par ton mot de passe et **ajoute `?connection_limit=5` à la fin** :

   ```
   postgresql://postgres.abcdefghijklmnop:TonMotDePasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?connection_limit=5
   ```

   C'est ta **`DATABASE_URL`** de production.

**Pourquoi le « Session pooler » et pas l'adresse directe ?** L'adresse directe (`db.<ref>.supabase.co`) n'est joignable qu'en IPv6, et Render fonctionne en IPv4 : la connexion échouerait. Le Session pooler accepte tout ce dont Prisma a besoin (migrations comprises). `connection_limit=5` évite d'épuiser les connexions du forfait gratuit.

5. **Protège l'API publique de Supabase.** Supabase expose par défaut les tables du schéma `public` via une API REST publique. L'application ne s'en sert pas, et le dépôt contient déjà une migration qui active la « Row Level Security » sur toutes les tables (elle s'applique toute seule au premier démarrage). Par précaution supplémentaire, désactive aussi cette API dans **Project Settings → Data API** (l'emplacement exact varie selon la version de l'interface).

Rien d'autre à faire ici : **les tables sont créées automatiquement** par les migrations au premier démarrage de l'API.

---

## 2. Render — l'API

1. **New +** → **Blueprint** → connecte ton compte GitHub si ce n'est pas fait, puis choisis le dépôt `YourFood`. Render lit le fichier [`render.yaml`](./render.yaml) et propose le service **`yourfood-api`**.
2. Il te demande les valeurs des variables marquées « à renseigner » :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | l'adresse Supabase de l'étape 1 |
   | `FRONTEND_URL` | provisoirement `https://exemple.vercel.app` (tu la corrigeras à l'étape 4) |

   `JWT_SECRET` est **généré automatiquement** par Render. `NODE_ENV`, `NODE_VERSION` et `TZ` sont déjà fixés dans le fichier.
3. Clique sur **Apply**. Render construit puis démarre l'API. Suis les **Logs** : tu dois voir les migrations s'appliquer (`Applying migration …`) puis `🚀 Backend meal-app démarré`.
4. Note l'adresse publique du service (en haut de sa page), par exemple **`https://yourfood-api.onrender.com`**.
5. Teste dans ton navigateur : `https://yourfood-api.onrender.com/api/health` doit afficher `{"status":"ok",…}`.

**Sans Blueprint** (création manuelle du service) : *New + → Web Service*, runtime **Node**, région **Frankfurt**, et :

| Champ | Valeur |
|---|---|
| Build Command | `npm ci --include=dev && npm run build --workspace=apps/backend` |
| Start Command | `npm run start:prod --workspace=apps/backend` |
| Health Check Path | `/api/health` |
| Variables | `NODE_ENV=production`, `NODE_VERSION=22`, `TZ=Africa/Kinshasa`, `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET` (au moins 32 caractères aléatoires) |

**Si le démarrage échoue**, les Logs disent pourquoi :
- `Configuration invalide : …` → une variable manque ou est mal formée (le message la nomme).
- `P1001 Can't reach database server` → mauvaise `DATABASE_URL` (adresse directe au lieu du Session pooler, mot de passe avec symboles, espace en trop).
- `P1000 Authentication failed` → mot de passe de la base erroné.

### Plan gratuit ou payant ?

| | Gratuit | Starter (~7 $/mois) |
|---|---|---|
| Service toujours allumé | Non : il **s'endort après 15 min** sans requête ; le premier client de la journée attend 30 à 60 s | Oui |
| Verrouillage de 20h | Déclenché à la prochaine requête après 20h (correct, mais pas à l'heure pile) | À 20h00 pile, sans que personne n'ouvre l'application |

Le fichier `render.yaml` est en `plan: free` pour un premier essai. **Pour une utilisation réelle, passe en Starter** (Render → le service → *Settings → Instance Type*). Si tu restes en gratuit, un service de « ping » (par exemple UptimeRobot, toutes les 10 minutes sur `/api/health`) limite l'endormissement.

---

## 3. Vercel — le site

1. **Add New… → Project** → importe le dépôt `YourFood`.
2. Règle :

   | Champ | Valeur |
   |---|---|
   | **Root Directory** | `apps/frontend` |
   | Framework Preset | Vite (détecté) |
   | Build / Install / Output | laisse : ils viennent de [`apps/frontend/vercel.json`](./apps/frontend/vercel.json) |

3. Dans **Environment Variables**, ajoute (pour *Production*, et *Preview* si tu veux tester les branches) :

   | Nom | Valeur |
   |---|---|
   | `VITE_API_URL` | `https://yourfood-api.onrender.com/api` (l'adresse Render de l'étape 2, **avec `/api` à la fin**) |

4. **Deploy**. Note l'adresse du site, par exemple **`https://yourfood.vercel.app`**.

> `VITE_API_URL` est intégrée au site **au moment du build** : si tu la changes plus tard, il faut **redéployer** (Deployments → ⋯ → Redeploy).

Domaine personnalisé (facultatif) : *Settings → Domains*. Utilise ensuite ce domaine à l'étape 4.

---

## 4. Relier Render à Vercel

L'API doit connaître l'adresse du site : pour l'autoriser (CORS) et pour fabriquer les liens et QR codes envoyés aux clients.

1. Render → `yourfood-api` → **Environment**.
2. Remplace `FRONTEND_URL` par l'adresse Vercel réelle : `https://yourfood.vercel.app` (**https, sans `/` final**).
3. Enregistre : Render redéploie tout seul.

> Si tu utilises plusieurs adresses (domaine personnalisé + adresse `.vercel.app`), ajoute la variable `CORS_ORIGIN` avec les adresses séparées par des virgules. `FRONTEND_URL` reste l'adresse principale, celle des liens envoyés aux clients.

---

## 5. Créer le compte administratrice

Le seed (`npm run prisma:seed`) contient des mots de passe de démonstration connus : **il est volontairement interdit en production**. On crée le compte à la main, depuis ton ordinateur, en visant la base Supabase.

Dans le dossier `apps/backend`, avec l'adresse de l'étape 1 :

**PowerShell (Windows)**
```powershell
cd apps\backend
$env:DATABASE_URL = "postgresql://postgres.abcdefghijklmnop:TonMotDePasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?connection_limit=5"
npm run create-admin
```

**Bash (Git Bash, Mac, Linux)**
```bash
cd apps/backend
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:TonMotDePasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?connection_limit=5" npm run create-admin
```

Le script demande le prénom, le nom et le mot de passe (**12 caractères minimum**). L'identifiant de connexion de l'administratrice sera « Prénom Nom ». Relancer la commande avec le même nom **change son mot de passe** (et ferme ses sessions ouvertes).

> Ferme ensuite le terminal ou vide la variable (`Remove-Item Env:DATABASE_URL`) pour ne pas viser la production par erreur la prochaine fois.

---

## 6. Vérifier que tout fonctionne

- [ ] `https://…onrender.com/api/health` répond `ok`.
- [ ] `https://…vercel.app/admin/connexion` : connexion avec le compte de l'étape 5.
- [ ] *Clients → Nouveau client* : le client est créé, le **lien** commence bien par l'adresse Vercel (et non `localhost`).
- [ ] Le **QR code** scanné avec un téléphone ouvre la page de première connexion, nom et code déjà remplis.
- [ ] Publie un menu, connecte-toi en tant que ce client sur un téléphone, commande, annule, reprends.
- [ ] Après 20h00 (heure de Kinshasa), le menu est verrouillé et les clients sans choix reçoivent le repas par défaut.

## Mises à jour

Chaque fusion dans `main` redéploie automatiquement Render et Vercel. Les **migrations de base de données s'appliquent toutes seules** au démarrage de l'API (`prisma migrate deploy`).

## Sauvegardes et exploitation

- **Sauvegardes** : la SPEC prévoit des sauvegardes automatiques. Vérifie dans Supabase → *Database → Backups* ce que ton forfait inclut : l'offre gratuite n'offre pas les mêmes garanties qu'une offre payante. Pour une activité réelle, prends une offre avec sauvegardes quotidiennes.
- **Projet Supabase gratuit** : il est **mis en pause après une semaine sans activité**. Une application utilisée chaque jour n'est pas concernée, mais garde-le en tête pendant les vacances.
- **Secrets** : `JWT_SECRET` et le mot de passe de la base ne sortent jamais de Render / Supabase. Si l'un d'eux fuite : change-le (Render → Environment ; Supabase → *Database → Settings → Reset password*, puis mets à jour `DATABASE_URL`). Changer `JWT_SECRET` déconnecte tout le monde.
- **Journaux** : Render → *Logs* (API), Vercel → *Logs* (site), Supabase → *Logs* (base).
