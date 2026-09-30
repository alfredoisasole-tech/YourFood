/**
 * Routes : espace du client connecté (historique).
 * Conforme à SPEC.md (7) et AG_RULES.md (4.1).
 */

import { Router } from 'express';
import { clientController } from '../controllers/client.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validateQuery } from '../middlewares/validate';
import { standardRateLimiter } from '../middlewares/rateLimiter';
import { Role, clientHistoryQuerySchema } from '@meal-app/shared';

const router = Router();

router.use(authenticate, requireRole(Role.CLIENT), standardRateLimiter);

// Historique en lecture seule : recherche par plat et filtre par dates
router.get('/history', validateQuery(clientHistoryQuerySchema), (req, res, next) => {
  clientController.getMyHistory(req, res, next);
});

export default router;
