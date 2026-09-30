/**
 * Routes : Catalogue de plats (Admin).
 * Conforme à SPEC.md (5.4) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { Role, createCatalogItemSchema, updateCatalogItemSchema } from '@meal-app/shared';

const router = Router();

// Toutes les routes de gestion du catalogue nécessitent le rôle admin
router.use(authenticate, requireRole(Role.ADMIN));

// Consultation de l'ensemble du catalogue
router.get('/', (req, res, next) => {
  catalogController.getAll(req, res, next);
});

// Création d'un plat dans le catalogue
router.post('/', validateBody(createCatalogItemSchema), (req, res, next) => {
  catalogController.create(req, res, next);
});

// Modification d'un plat existant
router.put('/:id', validateBody(updateCatalogItemSchema), (req, res, next) => {
  catalogController.update(req, res, next);
});

// Désactivation / suppression d'un plat
router.delete('/:id', (req, res, next) => {
  catalogController.delete(req, res, next);
});

export default router;
