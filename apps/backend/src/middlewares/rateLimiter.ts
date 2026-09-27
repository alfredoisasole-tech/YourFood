/**
 * Middlewares de Rate Limiting.
 * Conforme à SPEC.md (section 2 & 9) et AG_RULES.md (3.3).
 */

import rateLimit from 'express-rate-limit';

/** Limiteur strict pour les routes sensibles d'authentification et de code */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives maximum par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives de connexion, veuillez patienter 15 minutes avant de réessayer.',
  },
});

/** Limiteur pour les opérations courantes de commande et d'avis */
export const standardRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
