import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// Configuration dayjs pour le fuseau horaire Africa/Kinshasa
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Africa/Kinshasa');

const app = express();

// Middlewares globaux
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
});
app.use(globalLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: dayjs().tz('Africa/Kinshasa').toISOString() });
});

// TODO: Monter les routes ici
// app.use('/api/auth', authRouter);
// app.use('/api/offers', offersRouter);
// app.use('/api/orders', ordersRouter);
// app.use('/api/admin', adminRouter);
// app.use('/api/reviews', reviewsRouter);

// Validation de la configuration au démarrage
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
  console.log(`⏰ Timezone : Africa/Kinshasa — ${dayjs().tz('Africa/Kinshasa').format('YYYY-MM-DD HH:mm:ss')}`);
});

export default app;
