import { describe, it, expect } from 'vitest';
import {
  isMeatAllowed,
  getWorkingDays,
  getOfferTimeStatus,
} from '../../src/utils/time';
import { SubscriptionPlan } from '@meal-app/shared';

describe('Time Utilities (Fuseau horaire Africa/Kinshasa & Règles Métier)', () => {
  describe('isMeatAllowed (SPEC 4 & 5.6)', () => {
    // 2026-09-28 est un Lundi (1)
    // 2026-09-29 est un Mardi (2)
    // 2026-09-30 est un Mercredi (3)
    // 2026-10-01 est un Jeudi (4)
    // 2026-10-02 est un Vendredi (5)
    // 2026-10-03 est un Samedi (6)
    // 2026-10-04 est un Dimanche (0)

    it('devrait autoriser la viande pour la formule 25 000 FC UNIQUEMENT le lundi et le vendredi', () => {
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-09-28')).toBe(true); // Lundi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-09-29')).toBe(false); // Mardi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-09-30')).toBe(false); // Mercredi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-10-01')).toBe(false); // Jeudi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-10-02')).toBe(true); // Vendredi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-10-03')).toBe(false); // Samedi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_25000, '2026-10-04')).toBe(false); // Dimanche
    });

    it('devrait autoriser la viande pour la formule 35 000 FC du lundi au vendredi mais pas le week-end', () => {
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-09-28')).toBe(true); // Lundi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-09-29')).toBe(true); // Mardi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-09-30')).toBe(true); // Mercredi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-10-01')).toBe(true); // Jeudi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-10-02')).toBe(true); // Vendredi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-10-03')).toBe(false); // Samedi
      expect(isMeatAllowed(SubscriptionPlan.PLAN_35000, '2026-10-04')).toBe(false); // Dimanche
    });
  });

  describe('getWorkingDays (SPEC 5.5)', () => {
    it('devrait sauter le samedi et le dimanche lors de la génération des jours ouvrés', () => {
      // Début le vendredi 2026-10-02, 3 jours demandés
      const days = getWorkingDays('2026-10-02', 3);
      expect(days).toEqual([
        '2026-10-02', // Vendredi
        '2026-10-05', // Lundi
        '2026-10-06', // Mardi
      ]);
      expect(days).toHaveLength(3);
      expect(days).not.toContain('2026-10-03');
      expect(days).not.toContain('2026-10-04');
    });
  });

  describe('getOfferTimeStatus (SPEC 5.6)', () => {
    it('retourne un des statuts attendus (normal, en_retard ou verrouille)', () => {
      const status = getOfferTimeStatus('13:00');
      expect(['normal', 'en_retard', 'verrouille']).toContain(status);
    });
  });
});
