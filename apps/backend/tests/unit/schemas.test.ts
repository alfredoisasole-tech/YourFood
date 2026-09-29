import { describe, it, expect } from 'vitest';
import {
  createClientSchema,
  renewSubscriptionSchema,
  verifyCodeSchema,
  publishSingleOfferSchema,
  updateOfferSchema,
  submitReviewSchema,
  passwordSchema,
} from '@meal-app/shared';

const validClient = {
  nom: 'Kabongo',
  prenom: 'Mireille',
  formule: '35000',
  duree: { unite: 'semaines', valeur: 2 },
};

describe('Schémas de validation partagés', () => {
  describe('createClientSchema', () => {
    it('accepte un client sans téléphone (facultatif)', () => {
      expect(createClientSchema.safeParse(validClient).success).toBe(true);
    });

    it('traite un téléphone vide comme « pas de numéro »', () => {
      const parsed = createClientSchema.parse({ ...validClient, telephone: '' });
      expect(parsed.telephone).toBeUndefined();
    });

    it('normalise un numéro saisi avec des espaces', () => {
      const parsed = createClientSchema.parse({ ...validClient, telephone: '+243 81 234 5678' });
      expect(parsed.telephone).toBe('+243812345678');
    });

    it('refuse un numéro sans indicatif international', () => {
      expect(createClientSchema.safeParse({ ...validClient, telephone: '0812345678' }).success).toBe(false);
    });

    it('n\'accepte qu\'un lundi comme date de début', () => {
      expect(createClientSchema.safeParse({ ...validClient, dateDebut: '2026-10-05' }).success).toBe(true);
      expect(createClientSchema.safeParse({ ...validClient, dateDebut: '2026-10-06' }).success).toBe(false);
    });

    it('limite la durée à 3 semaines ou 12 mois', () => {
      expect(createClientSchema.safeParse({ ...validClient, duree: { unite: 'semaines', valeur: 4 } }).success).toBe(false);
      expect(createClientSchema.safeParse({ ...validClient, duree: { unite: 'mois', valeur: 12 } }).success).toBe(true);
      expect(createClientSchema.safeParse({ ...validClient, duree: { unite: 'mois', valeur: 13 } }).success).toBe(false);
    });
  });

  describe('renewSubscriptionSchema', () => {
    it('accepte une durée seule : le lundi de début est déduit par le serveur', () => {
      expect(renewSubscriptionSchema.safeParse({ duree: { unite: 'mois', valeur: 1 } }).success).toBe(true);
    });

    it('refuse un début qui n\'est pas un lundi', () => {
      expect(
        renewSubscriptionSchema.safeParse({ duree: { unite: 'mois', valeur: 1 }, dateDebut: '2026-11-03' }).success
      ).toBe(false);
    });
  });

  describe('code d\'accès saisi par le client', () => {
    it('accepte l\'affichage avec espace « RN7Q 3M8K »', () => {
      const parsed = verifyCodeSchema.parse({ identifiant: 'Ruth Ngoy', code: 'RN7Q 3M8K' });
      expect(parsed.code).toBe('RN7Q3M8K');
    });

    it('refuse un code mal formé', () => {
      expect(verifyCodeSchema.safeParse({ identifiant: 'Ruth Ngoy', code: '12345678' }).success).toBe(false);
    });
  });

  describe('mot de passe', () => {
    it('exige 8 caractères minimum (maquette)', () => {
      expect(passwordSchema.safeParse('1234567').success).toBe(false);
      expect(passwordSchema.safeParse('12345678').success).toBe(true);
    });
  });

  describe('menus (SPEC 5.5)', () => {
    it('accepte un nombre libre d\'options par catégorie', () => {
      const parsed = publishSingleOfferSchema.safeParse({
        date: '2026-10-05',
        catalogItemIds: [1, 2, 3, 4, 5, 6, 7, 8],
      });
      expect(parsed.success).toBe(true);
    });

    it('refuse un menu de moins de 3 plats et un doublon', () => {
      expect(publishSingleOfferSchema.safeParse({ date: '2026-10-05', catalogItemIds: [1, 2] }).success).toBe(false);
      expect(publishSingleOfferSchema.safeParse({ date: '2026-10-05', catalogItemIds: [1, 1, 2] }).success).toBe(false);
    });

    it('refuse un menu un week-end', () => {
      expect(publishSingleOfferSchema.safeParse({ date: '2026-10-03', catalogItemIds: [1, 2, 3] }).success).toBe(false);
    });

    it('impose une heure limite indicative entre 11h00 et 19h00', () => {
      const base = { date: '2026-10-05', catalogItemIds: [1, 2, 3] };
      expect(publishSingleOfferSchema.parse(base).heureLimiteIndicative).toBe('13:00');
      expect(publishSingleOfferSchema.safeParse({ ...base, heureLimiteIndicative: '10:30' }).success).toBe(false);
      expect(publishSingleOfferSchema.safeParse({ ...base, heureLimiteIndicative: '19:30' }).success).toBe(false);
      expect(publishSingleOfferSchema.safeParse({ ...base, heureLimiteIndicative: '19:00' }).success).toBe(true);
    });

    it('refuse une modification vide', () => {
      expect(updateOfferSchema.safeParse({}).success).toBe(false);
      expect(updateOfferSchema.safeParse({ heureLimiteIndicative: '14:30' }).success).toBe(true);
    });
  });

  describe('avis (SPEC 5.9)', () => {
    it('exige une note ou un commentaire', () => {
      expect(submitReviewSchema.safeParse({ orderId: 1 }).success).toBe(false);
      expect(submitReviewSchema.safeParse({ orderId: 1, noteEtoile: 4 }).success).toBe(true);
      expect(submitReviewSchema.safeParse({ orderId: 1, commentaire: 'Très bon' }).success).toBe(true);
    });
  });
});
