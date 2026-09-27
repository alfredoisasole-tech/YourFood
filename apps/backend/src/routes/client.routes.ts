/**
 * Routes : Gestion des clients par l'administrateur.
 * Conforme à SPEC.md (5.1, 5.2, 5.3, 5.11) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { clientController } from '../controllers/client.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { Role, createClientSchema, renewSubscriptionSchema } from '@meal-app/shared';

const router = Router();

// Toutes les routes clients nécessitent les droits administrateur
router.use(authenticate, requireRole(Role.ADMIN));

// Inscription d'un nouveau client (SPEC 5.1 & 5.2)
router.post('/', validateBody(createClientSchema), (req, res, next) => {
  clientController.createClient(req, res, next);
});

// Liste de tous les clients avec statut et jours restants
router.get('/', (req, res, next) => {
  clientController.getAllClients(req, res, next);
});

// Fiche détaillée d'un client
router.get('/:id', (req, res, next) => {
  clientController.getClientDetail(req, res, next);
});

// Réinitialisation de mot de passe demandée par l'admin (SPEC 5.3)
router.post('/:subscriptionId/reset-password', (req, res, next) => {
  clientController.resetPassword(req, res, next);
});

// Renouvellement ou prolongation d'abonnement (SPEC 5.11)
router.post('/:subscriptionId/renew', validateBody(renewSubscriptionSchema), (req, res, next) => {
  clientController.renewSubscription(req, res, next);
});

export default router;
