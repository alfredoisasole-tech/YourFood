import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';
import { Role } from '@meal-app/shared';

const TEST_JWT_SECRET = 'test_secret_for_integration_testing_123456';

describe('Integration : Sécurité & Contrôle d\'accès (AG_RULES 3.3 & SPEC 7)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  const generateTestToken = (payload: { userId: number; nom: string; role: Role; subscriptionId?: number }) => {
    return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
  };

  describe('Protection 401 : Absence ou invalidité de token', () => {
    it('refuse l\'accès à /api/offers/today sans token (401)', async () => {
      const res = await request(app).get('/api/offers/today');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Token d\'authentification manquant');
    });

    it('refuse l\'accès à /api/orders sans token (401)', async () => {
      const res = await request(app).post('/api/orders').send({});
      expect(res.status).toBe(401);
    });

    it('refuse un token altéré ou malformé (401)', async () => {
      const res = await request(app)
        .get('/api/offers/today')
        .set('Authorization', 'Bearer token_invalide_non_dechiffrable');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Token d\'authentification invalide');
    });

    it('refuse un token signé avec une mauvaise clé secrète (401)', async () => {
      const fakeToken = jwt.sign({ userId: 1, role: Role.ADMIN }, 'wrong_secret');
      const res = await request(app)
        .get('/api/admin/clients')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Protection 403 : Garde de rôles (RBAC)', () => {
    it('interdit l\'accès aux routes admin pour un utilisateur avec rôle CLIENT (403)', async () => {
      const clientToken = generateTestToken({
        userId: 10,
        nom: 'KABAMBA',
        role: Role.CLIENT,
        subscriptionId: 1,
      });

      const res = await request(app)
        .get('/api/admin/clients')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Vous n\'avez pas les droits nécessaires');
    });

    it('interdit l\'accès au catalogue admin pour un utilisateur CLIENT (403)', async () => {
      const clientToken = generateTestToken({
        userId: 10,
        nom: 'KABAMBA',
        role: Role.CLIENT,
      });

      const res = await request(app)
        .get('/api/admin/catalog')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Validation des entrées Zod (AG_RULES 3.2)', () => {
    it('renvoie 400 Bad Request si le body ne respecte pas le schéma d\'authentification', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifiant: '' }); // motDePasse manquant et identifiant vide

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Données fournies invalides');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('renvoie 400 si le code d\'activation first-login n\'a pas 8 caractères', async () => {
      const res = await request(app)
        .post('/api/auth/first-login')
        .send({
          identifiant: 'Patrick KABAMBA',
          code: 'COURT', // 5 caractères au lieu de 8
          nouveauMotDePasse: 'Secret123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Données fournies invalides');
    });
  });
});
