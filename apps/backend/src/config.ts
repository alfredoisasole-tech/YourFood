/**
 * Configuration du serveur, lue une seule fois depuis les variables d'environnement.
 * Conforme à AG_RULES.md (3.1) : aucune valeur par défaut dangereuse en production.
 *
 * En développement et en test, des valeurs locales raisonnables sont utilisées ;
 * en production, toute variable manquante ou dangereuse empêche le serveur de démarrer.
 */

const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_SECRET_MARKER = 'CHANGE_ME';
const LOCAL_FRONTEND_URL = 'http://localhost:5173';

export interface AppConfig {
  isProduction: boolean;
  port: number;
  /** Adresse publique du frontend, utilisée dans les liens d'accès envoyés aux clients */
  frontendUrl: string;
  /** Origine(s) autorisée(s) par CORS */
  corsOrigins: string[];
  /** Nombre de proxys de confiance devant le serveur (hébergeur) : nécessaire pour connaître l'IP réelle */
  trustProxy: number;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`Variable d'environnement invalide : ${name}=${raw}`);
  }
  return value;
}

/**
 * Vérifie la configuration requise en production et retourne la liste des problèmes.
 * Exportée pour être testée.
 */
export function findConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL est manquante');
  }

  const secret = env.JWT_SECRET ?? '';
  if (!secret) {
    problems.push('JWT_SECRET est manquante');
  } else if (secret.includes(DEFAULT_SECRET_MARKER)) {
    problems.push('JWT_SECRET contient la valeur par défaut de .env.example');
  } else if (isProduction && secret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET doit compter au moins ${MIN_JWT_SECRET_LENGTH} caractères en production`);
  }

  if (isProduction) {
    if (!env.FRONTEND_URL) {
      problems.push('FRONTEND_URL est obligatoire en production (liens envoyés aux clients)');
    } else if (!/^https:\/\//.test(env.FRONTEND_URL)) {
      problems.push('FRONTEND_URL doit commencer par https:// en production');
    }
  }

  return problems;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const frontendUrl = (env.FRONTEND_URL ?? LOCAL_FRONTEND_URL).replace(/\/+$/, '');
  const corsOrigins = (env.CORS_ORIGIN ?? frontendUrl)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return {
    isProduction,
    port: readInt('PORT', 3001),
    frontendUrl,
    corsOrigins,
    trustProxy: readInt('TRUST_PROXY', isProduction ? 1 : 0),
  };
}

export const config = loadConfig();
