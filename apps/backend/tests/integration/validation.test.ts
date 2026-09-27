import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';
import { Role } from '@meal-app/shared';

const TEST_JWT_SECRET = 'test_secret_for_integration_testing_123456';

describe('Integration : Validation HTTP Zod des flux métier (AG_RULES 3.2 & SPEC 5)', () => {
  let adminToken: string;
  let clientToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    adminToken = jwt.sign({ userId: 1, nom: 'BOKETSU', role: Role.ADMIN }, TEST_JWT_SECRET, {
      expiresIn: '1h',
    });
    clientToken = jwt.sign(
      { userId: 10, nom: 'KABAMBA', role: Role.CLIENT, subscriptionId: 1 },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('Validation Authentification (SPEC 5.3 & 7)', () => {
    it('rejette un code d\'accès qui ne respecte pas le format à 8 caractères (400)', async () => {
      const res = await request(app)
        .post('/api/auth/first-login')
        .send({
          nom: 'KABAMBA',
          code: '12345678', // Ne commence pas par 2 initiales alphabétiques majuscules
          nouveauMotDePasse: 'ValidPass123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Données fournies invalides');
      expect(JSON.stringify(res.body.details)).toContain('code');
    });

    it('rejette un mot de passe trop court (< 6 caractères) (400)', async () => {
      const res = await request(app)
        .post('/api/auth/first-login')
        .send({
          nom: 'KABAMBA',
          code: 'KP1A2B3C',
          nouveauMotDePasse: '123', // trop court
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('nouveauMotDePasse');
    });
  });

  describe('Validation Création Client Admin (SPEC 5.1 & 5.2)', () => {
    it('rejette un numéro de téléphone sans indicatif pays international (400)', async () => {
      const res = await request(app)
        .post('/api/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'TSHILOMBO',
          prenom: 'Felix',
          telephone: '0812345678', // Format local sans +243
          formule: '25000',
          dureeJours: 30,
          dateDebut: '2026-10-01',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('telephone');
    });

    it('rejette une formule inexistante (400)', async () => {
      const res = await request(app)
        .post('/api/admin/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'TSHILOMBO',
          prenom: 'Felix',
          telephone: '+243812345678',
          formule: '50000', // Formule non supportée
          dureeJours: 30,
          dateDebut: '2026-10-01',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('formule');
    });
  });

  describe('Validation Catalogue de Plats (SPEC 5.4)', () => {
    it('rejette un plat avec une catégorie invalide (400)', async () => {
      const res = await request(app)
        .post('/api/admin/catalog')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'Boisson gazeuse',
          categorie: 'dessert', // Non autorisé, uniquement plat, accompagnement ou viande
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('categorie');
    });
  });

  describe('Validation Offres du Jour (SPEC 5.5)', () => {
    it('rejette une offre ne contenant pas exactement 6 items (400)', async () => {
      const res = await request(app)
        .post('/api/admin/offers/single')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          date: '2026-10-05',
          heureLimiteIndicative: '13:00',
          catalogItemIds: [1, 2, 3], // Seulement 3 au lieu de 6
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('catalogItemIds');
    });
  });

  describe('Validation Avis et Notations (SPEC 5.9)', () => {
    it('rejette une note supérieure à 5 étoiles (400)', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          orderId: 1,
          noteEtoile: 6, // Max = 5
          commentaire: 'Super repas',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.details)).toContain('noteEtoile');
    });
  });
});
