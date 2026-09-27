/**
 * Routes : Authentification & Sessions.
 * Conforme à AG_RULES.md (3.3 & 4.1).
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { firstLoginSchema, loginSchema, changePasswordSchema } from '@meal-app/shared';

const router = Router();

// Première connexion avec code d'activation (SPEC 5.3 & 7)
router.post('/first-login', authRateLimiter, validateBody(firstLoginSchema), (req, res, next) => {
  authController.firstLogin(req, res, next);
});

// Connexions ultérieures : nom + mot de passe (SPEC 5.3 & 7)
router.post('/login', authRateLimiter, validateBody(loginSchema), (req, res, next) => {
  authController.login(req, res, next);
});

// Modification du mot de passe par le client connecté (SPEC 5.3)
router.put('/change-password', authenticate, validateBody(changePasswordSchema), (req, res, next) => {
  authController.changePassword(req, res, next);
});

export default router;
