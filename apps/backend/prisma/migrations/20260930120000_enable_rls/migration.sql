-- Sécurité pour un hébergement sur Supabase.
--
-- Supabase expose le schéma "public" par son API REST (PostgREST) avec des clés publiques. Une table
-- sans « Row Level Security » y serait lisible et modifiable par quiconque connaît ces clés.
-- L'application n'utilise PAS cette API : elle se connecte directement à la base avec le rôle propriétaire
-- des tables (qui ignore la RLS). Activer la RLS sans aucune politique bloque donc l'API publique
-- sans rien changer au fonctionnement de l'application. Sans effet sur un PostgreSQL ordinaire.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offer_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
