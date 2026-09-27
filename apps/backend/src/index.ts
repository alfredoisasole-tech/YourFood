import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
  authRoutes,
  offerRoutes,
  orderRoutes,
  adminRoutes,
  reviewRoutes,
} from './routes';
import { errorHandler } from './middlewares/errorHandler';

// Configuration dayjs pour le fuseau horaire Africa/Kinshasa (SPEC 2 & 8)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Africa/Kinshasa');

const app = express();

// Middlewares globaux
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting global (SPEC 2 & 9)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
});
app.use(globalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timezone: 'Africa/Kinshasa',
    timestamp: dayjs().tz('Africa/Kinshasa').format('YYYY-MM-DD HH:mm:ss'),
  });
});

// Montage des routes de l'API
app.use('/api/auth', authRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Route 404 pour les endpoints inconnus
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Middleware centralisé de gestion des erreurs (doit être le dernier middleware)
app.use(errorHandler);

// Validation de la configuration au démarrage (en dehors des tests)
if (process.env.NODE_ENV !== 'test') {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Variable d'environnement manquante : ${envVar}`);
    }
  }

  if (process.env.JWT_SECRET === 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET') {
    throw new Error('JWT_SECRET doit être changé — valeur par défaut dangereuse détectée.');
  }

  const PORT = parseInt(process.env.PORT ?? '3001', 10);

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Backend meal-app démarré sur le port ${PORT}`);
    // eslint-disable-next-line no-console
    console.log(
      `⏰ Timezone : Africa/Kinshasa — ${dayjs().tz('Africa/Kinshasa').format('YYYY-MM-DD HH:mm:ss')}`
    );
  });
}

export default app;
