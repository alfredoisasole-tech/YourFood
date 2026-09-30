/**
 * Routes : Authentification & Sessions.
 * Conforme à AG_RULES.md (3.3 & 4.1).
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';
import {
  firstLoginSchema,
  loginSchema,
  changePasswordSchema,
  verifyCodeSchema,
} from '@meal-app/shared';

const router = Router();

// Première connexion, étape 1 : vérification du couple nom + code, sans consommer le code (SPEC 7)
router.post('/verify-code', authRateLimiter, validateBody(verifyCodeSchema), (req, res, next) => {
  authController.verifyCode(req, res, next);
});

// Première connexion, étape 2 : création du mot de passe (SPEC 5.3 & 7)
router.post('/first-login', authRateLimiter, validateBody(firstLoginSchema), (req, res, next) => {
  authController.firstLogin(req, res, next);
});

// Connexions ultérieures : identifiant + mot de passe (SPEC 5.3 & 7)
router.post('/login', authRateLimiter, validateBody(loginSchema), (req, res, next) => {
  authController.login(req, res, next);
});

// Session courante : utilisateur + abonnement (recalculé à chaque appel)
router.get('/me', authenticate, (req, res, next) => {
  authController.me(req, res, next);
});

// Modification du mot de passe par le client connecté (SPEC 5.3)
router.put('/change-password', authenticate, validateBody(changePasswordSchema), (req, res, next) => {
  authController.changePassword(req, res, next);
});

export default router;
