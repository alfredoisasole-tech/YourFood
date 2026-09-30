import { describe, it, expect } from 'vitest';
import { findConfigProblems, loadConfig } from '../../src/config';

const base = {
  DATABASE_URL: 'postgresql://localhost/mealapp',
  JWT_SECRET: 'un_secret_suffisamment_long_pour_la_prod_123',
};

describe('Configuration du serveur (AG_RULES 3.1)', () => {
  it('accepte une configuration de développement minimale', () => {
    expect(findConfigProblems({ ...base, NODE_ENV: 'development' })).toEqual([]);
  });

  it('refuse le secret JWT d\'exemple', () => {
    const problems = findConfigProblems({ ...base, JWT_SECRET: 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET' });
    expect(problems.join()).toContain('valeur par défaut');
  });

  it('exige en production une adresse de frontend en https et un secret long', () => {
    const problems = findConfigProblems({ ...base, NODE_ENV: 'production', JWT_SECRET: 'court' });
    expect(problems.join()).toContain('FRONTEND_URL');
    expect(problems.join()).toContain('32 caractères');

    const ok = findConfigProblems({ ...base, NODE_ENV: 'production', FRONTEND_URL: 'https://yourfood.app' });
    expect(ok).toEqual([]);
  });

  it('fait confiance à un proxy en production et autorise le frontend par CORS', () => {
    const prod = loadConfig({ NODE_ENV: 'production', FRONTEND_URL: 'https://yourfood.app/' });
    expect(prod.trustProxy).toBe(1);
    expect(prod.frontendUrl).toBe('https://yourfood.app');
    expect(prod.corsOrigins).toEqual(['https://yourfood.app']);

    expect(loadConfig({}).trustProxy).toBe(0);
  });
});
