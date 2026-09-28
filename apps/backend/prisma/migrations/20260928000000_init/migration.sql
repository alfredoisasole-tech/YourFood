-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'client');

-- CreateEnum
CREATE TYPE "Formule" AS ENUM ('25000', '35000');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('actif', 'expire');

-- CreateEnum
CREATE TYPE "AccessCodeType" AS ENUM ('activation', 'reinitialisation');

-- CreateEnum
CREATE TYPE "CategorieItem" AS ENUM ('plat', 'accompagnement', 'viande');

-- CreateEnum
CREATE TYPE "StatutOffre" AS ENUM ('ouvert', 'verrouille');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('en_attente', 'verrouillee', 'annulee');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "telephone" VARCHAR(20) NOT NULL,
    "mot_de_passe_hash" VARCHAR(255),
    "role" "Role" NOT NULL DEFAULT 'client',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "formule" "Formule" NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "bonus" VARCHAR(255),
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_codes" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "type" "AccessCodeType" NOT NULL,
    "date_generation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "date_utilisation" TIMESTAMP(3),

    CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" SERIAL NOT NULL,
    "categorie" "CategorieItem" NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_offers" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "heure_limite_indicative" VARCHAR(5) NOT NULL DEFAULT '13:00',
    "statut" "StatutOffre" NOT NULL DEFAULT 'ouvert',

    CONSTRAINT "daily_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_options" (
    "id" SERIAL NOT NULL,
    "daily_offer_id" INTEGER NOT NULL,
    "catalog_item_id" INTEGER NOT NULL,

    CONSTRAINT "offer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "daily_offer_id" INTEGER NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "plat_id" INTEGER NOT NULL,
    "accompagnement_id" INTEGER NOT NULL,
    "viande_id" INTEGER,
    "statut" "StatutCommande" NOT NULL DEFAULT 'en_attente',
    "est_defaut" BOOLEAN NOT NULL DEFAULT false,
    "prepare" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "commentaire" TEXT,
    "note_etoile" SMALLINT,
    "rempli" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telephone_key" ON "users"("telephone");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_statut_idx" ON "subscriptions"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "access_codes_code_key" ON "access_codes"("code");

-- CreateIndex
CREATE INDEX "access_codes_code_idx" ON "access_codes"("code");

-- CreateIndex
CREATE INDEX "catalog_items_categorie_idx" ON "catalog_items"("categorie");

-- CreateIndex
CREATE INDEX "catalog_items_actif_idx" ON "catalog_items"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "daily_offers_date_key" ON "daily_offers"("date");

-- CreateIndex
CREATE INDEX "daily_offers_date_idx" ON "daily_offers"("date");

-- CreateIndex
CREATE INDEX "offer_options_daily_offer_id_idx" ON "offer_options"("daily_offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_options_daily_offer_id_catalog_item_id_key" ON "offer_options"("daily_offer_id", "catalog_item_id");

-- CreateIndex
CREATE INDEX "orders_daily_offer_id_idx" ON "orders"("daily_offer_id");

-- CreateIndex
CREATE INDEX "orders_subscription_id_idx" ON "orders"("subscription_id");

-- CreateIndex
CREATE INDEX "orders_statut_idx" ON "orders"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "orders_daily_offer_id_subscription_id_key" ON "orders"("daily_offer_id", "subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_options" ADD CONSTRAINT "offer_options_daily_offer_id_fkey" FOREIGN KEY ("daily_offer_id") REFERENCES "daily_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_options" ADD CONSTRAINT "offer_options_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_daily_offer_id_fkey" FOREIGN KEY ("daily_offer_id") REFERENCES "daily_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_plat_id_fkey" FOREIGN KEY ("plat_id") REFERENCES "offer_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_accompagnement_id_fkey" FOREIGN KEY ("accompagnement_id") REFERENCES "offer_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_viande_id_fkey" FOREIGN KEY ("viande_id") REFERENCES "offer_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
