-- Invalidation des sessions : chaque changement de mot de passe incrémente token_version,
-- et un jeton JWT émis avec une version antérieure est refusé.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
