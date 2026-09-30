-- Alignement sur la maquette et la SPEC v3.1
--   1. Téléphone facultatif
--   2. Identifiant de connexion unique « prénom nom » (login_key)
--   3. Commande annulée possible sans aucun choix (plat / accompagnement facultatifs)
--   4. Suppression douce des plats déjà servis (historique conservé)

-- 1. Téléphone facultatif
ALTER TABLE "users" ALTER COLUMN "telephone" DROP NOT NULL;

-- 2. Identifiant de connexion : ajouté nullable, rempli pour l'existant, puis rendu obligatoire.
--    L'application normalise aussi les accents ; les comptes existants doivent être recréés (seed)
--    ou corrigés si leurs noms contiennent des accents.
ALTER TABLE "users" ADD COLUMN "login_key" VARCHAR(220);
UPDATE "users" SET "login_key" = lower(btrim("prenom")) || ' ' || lower(btrim("nom"));
ALTER TABLE "users" ALTER COLUMN "login_key" SET NOT NULL;
CREATE UNIQUE INDEX "users_login_key_key" ON "users"("login_key");

-- 3. Commande annulée sans choix
ALTER TABLE "orders" ALTER COLUMN "plat_id" DROP NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "accompagnement_id" DROP NOT NULL;
-- Seule une commande annulée peut n'avoir aucun choix
ALTER TABLE "orders" ADD CONSTRAINT "orders_choix_requis_sauf_annulee"
  CHECK ("statut" = 'annulee' OR ("plat_id" IS NOT NULL AND "accompagnement_id" IS NOT NULL));

-- 4. Suppression douce des plats
ALTER TABLE "catalog_items" ADD COLUMN "supprime" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "catalog_items_supprime_idx" ON "catalog_items"("supprime");
