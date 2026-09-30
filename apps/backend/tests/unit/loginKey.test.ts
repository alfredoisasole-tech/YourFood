import { describe, it, expect } from 'vitest';
import { buildLoginKey, loginKeyCandidates, normalizeName } from '../../src/utils/loginKey';

describe('Identifiant de connexion « prénom nom »', () => {
  it('ignore la casse, les accents et les espaces multiples', () => {
    expect(buildLoginKey('Joséphine', ' TSHIMANGA ')).toBe('josephine tshimanga');
    expect(normalizeName('  Grâce   Mwamba ')).toBe('grace mwamba');
  });

  it('distingue deux clients de même nom de famille (cas Kalala et Kasongo de la maquette)', () => {
    expect(buildLoginKey('Deborah', 'Kalala')).not.toBe(buildLoginKey('Freddy', 'Kalala'));
    expect(buildLoginKey('Joël', 'Kasongo')).not.toBe(buildLoginKey('Jonathan', 'Kasongo'));
  });

  it('accepte aussi « Nom Prénom » quand l\'identifiant tient en deux mots', () => {
    expect(loginKeyCandidates('Mukendi Amani')).toEqual(['mukendi amani', 'amani mukendi']);
  });

  it('n\'inverse pas les identifiants de plus de deux mots', () => {
    expect(loginKeyCandidates('Jean Pierre Mukendi')).toEqual(['jean pierre mukendi']);
  });
});
