/**
 * Middlewares de Rate Limiting.
 * Conforme à SPEC.md (section 2 & 9) et AG_RULES.md (3.3).
 */

import { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { normalizeName } from '../utils/loginKey';

const AUTH_WINDOW_MS = 15 * 60 * 1000;

/**
 * Clé du limiteur de connexion : adresse IP + identifiant saisi.
 * Plusieurs clients derrière la même adresse (réseau mobile, bureau) ne se bloquent donc pas
 * entre eux, tandis que les essais répétés sur un même compte restent limités.
 */
function authKey(req: Request): string {
  const body = req.body as { identifiant?: unknown } | undefined;
  const identifiant = typeof body?.identifiant === 'string' ? normalizeName(body.identifiant) : '';
  return `${req.ip ?? 'inconnue'}|${identifiant}`;
}

/** 10 tentatives par compte et par adresse IP toutes les 15 minutes */
const perAccountLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKey,
  message: {
    error: 'Trop de tentatives de connexion, veuillez patienter 15 minutes avant de réessayer.',
  },
});

/** Garde-fou global par adresse IP (essais sur de nombreux comptes) */
const perIpLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion depuis ce réseau, veuillez patienter quelques minutes.',
  },
});

/** Limiteur des routes sensibles d'authentification et de code */
export const authRateLimiter: RequestHandler = (req, res, next) => {
  perIpLimiter(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    perAccountLimiter(req, res, next);
  });
};

/** Limiteur pour les opérations courantes de commande et d'avis */
export const standardRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
