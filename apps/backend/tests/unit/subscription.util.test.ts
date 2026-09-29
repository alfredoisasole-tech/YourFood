import { describe, it, expect } from 'vitest';
import {
  SubscriptionPlan,
  computeSubscriptionEnd,
  countWorkingDays,
  durationToWeeks,
  getSubscriptionState,
  isMeatIncluded,
  nextMonday,
  pickCurrentPeriod,
  previousWorkingDay,
  subscriptionTotalFc,
  periodWeeks,
} from '@meal-app/shared';

// Repères : 2026-09-28 lundi, 2026-09-29 mardi, 2026-10-02 vendredi, 2026-10-03 samedi, 2026-10-04 dimanche

describe('Règles d\'abonnement partagées (SPEC 5.1, 5.11)', () => {
  describe('nextMonday', () => {
    it('renvoie le lundi suivant, strictement après la date', () => {
      expect(nextMonday('2026-09-29')).toBe('2026-10-05'); // mardi
      expect(nextMonday('2026-10-03')).toBe('2026-10-05'); // samedi
      expect(nextMonday('2026-10-04')).toBe('2026-10-05'); // dimanche
      expect(nextMonday('2026-09-28')).toBe('2026-10-05'); // un lundi renvoie le lundi d'après
    });

    it('renvoie la date elle-même pour un lundi si includeToday', () => {
      expect(nextMonday('2026-09-28', true)).toBe('2026-09-28');
    });
  });

  describe('computeSubscriptionEnd', () => {
    it('finit toujours un vendredi : 1 semaine = du lundi au vendredi', () => {
      expect(computeSubscriptionEnd('2026-10-05', 1)).toBe('2026-10-09');
    });

    it('gère plusieurs semaines : 8 semaines du 7 septembre au 30 octobre (maquette)', () => {
      expect(computeSubscriptionEnd('2026-09-07', 8)).toBe('2026-10-30');
    });

    it('refuse un début qui n\'est pas un lundi', () => {
      expect(() => computeSubscriptionEnd('2026-09-29', 2)).toThrow(RangeError);
    });
  });

  describe('durationToWeeks', () => {
    it('convertit les mois en semaines : 1 mois = 4 semaines', () => {
      expect(durationToWeeks({ unite: 'mois', valeur: 1 })).toBe(4);
      expect(durationToWeeks({ unite: 'mois', valeur: 3 })).toBe(12);
      expect(durationToWeeks({ unite: 'semaines', valeur: 2 })).toBe(2);
    });
  });

  describe('prix hebdomadaire', () => {
    it('additionne les semaines : 35 000 FC × 8 = 280 000 FC (maquette)', () => {
      expect(subscriptionTotalFc(SubscriptionPlan.PLAN_35000, 8)).toBe(280000);
      expect(subscriptionTotalFc(SubscriptionPlan.PLAN_25000, 1)).toBe(25000);
    });

    it('retrouve le nombre de semaines d\'une période', () => {
      expect(periodWeeks({ dateDebut: '2026-09-07', dateFin: '2026-10-30' })).toBe(8);
    });
  });

  describe('countWorkingDays', () => {
    it('compte les jours ouvrés bornes incluses : 24 du 29 sept. au 30 oct. (maquette)', () => {
      expect(countWorkingDays('2026-09-29', '2026-10-30')).toBe(24);
    });

    it('ignore les week-ends et renvoie 0 si la fin précède le début', () => {
      expect(countWorkingDays('2026-10-03', '2026-10-04')).toBe(0);
      expect(countWorkingDays('2026-10-05', '2026-10-01')).toBe(0);
    });
  });

  describe('previousWorkingDay', () => {
    it('renvoie le vendredi pour un lundi', () => {
      expect(previousWorkingDay('2026-09-28')).toBe('2026-09-25');
      expect(previousWorkingDay('2026-09-29')).toBe('2026-09-28');
    });
  });

  describe('isMeatIncluded (SPEC 4)', () => {
    it('formule 25 000 : viande le lundi et le vendredi seulement', () => {
      expect(isMeatIncluded(SubscriptionPlan.PLAN_25000, '2026-09-28')).toBe(true);
      expect(isMeatIncluded(SubscriptionPlan.PLAN_25000, '2026-09-29')).toBe(false);
      expect(isMeatIncluded(SubscriptionPlan.PLAN_25000, '2026-10-02')).toBe(true);
    });

    it('formule 35 000 : viande tous les jours ouvrés, jamais le week-end', () => {
      expect(isMeatIncluded(SubscriptionPlan.PLAN_35000, '2026-09-29')).toBe(true);
      expect(isMeatIncluded(SubscriptionPlan.PLAN_35000, '2026-10-03')).toBe(false);
    });
  });

  describe('getSubscriptionState', () => {
    const period = { dateDebut: '2026-09-07', dateFin: '2026-10-30' };

    it('actif quand il reste plus de 10 jours ouvrés', () => {
      expect(getSubscriptionState(period, '2026-09-29')).toEqual({ etat: 'actif', joursRestants: 24 });
    });

    it('bientôt expiré à partir de 10 jours ouvrés restants', () => {
      const { etat, joursRestants } = getSubscriptionState(period, '2026-10-19');
      expect(joursRestants).toBe(10);
      expect(etat).toBe('bientot_expire');
    });

    it('le dernier jour est encore actif, avec 1 jour restant', () => {
      expect(getSubscriptionState(period, '2026-10-30')).toEqual({
        etat: 'bientot_expire',
        joursRestants: 1,
      });
    });

    it('expiré après la date de fin, sans dépendre d\'un champ statut', () => {
      expect(getSubscriptionState(period, '2026-11-02')).toEqual({ etat: 'expire', joursRestants: 0 });
    });

    it('pas encore commencé avant la date de début', () => {
      expect(getSubscriptionState({ dateDebut: '2026-10-05', dateFin: '2026-10-09' }, '2026-09-29')).toEqual({
        etat: 'non_commence',
        joursRestants: 5,
      });
    });
  });

  describe('pickCurrentPeriod', () => {
    const past = { dateDebut: '2026-08-03', dateFin: '2026-08-28' };
    const current = { dateDebut: '2026-09-07', dateFin: '2026-10-30' };
    const future = { dateDebut: '2026-11-02', dateFin: '2026-11-27' };

    it('préfère la période qui couvre aujourd\'hui, même si une suivante est déjà enregistrée', () => {
      expect(pickCurrentPeriod([past, future, current], '2026-09-29')).toBe(current);
    });

    it('prend la prochaine période quand rien ne couvre aujourd\'hui', () => {
      expect(pickCurrentPeriod([past, future], '2026-09-29')).toBe(future);
    });

    it('prend la plus récente quand tout est terminé', () => {
      expect(pickCurrentPeriod([past, current], '2026-12-01')).toBe(current);
    });

    it('renvoie null sans aucune période', () => {
      expect(pickCurrentPeriod([], '2026-09-29')).toBeNull();
    });
  });
});
