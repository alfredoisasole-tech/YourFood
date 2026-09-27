import { describe, it, expect } from 'vitest';
import { generateActivationCode } from '../../src/utils/codeGenerator';
import { accessCodeSchema } from '@meal-app/shared';

describe('Code Generator (SPEC 2 & 5.2)', () => {
  it('devrait générer un code composé exactement de 8 caractères', () => {
    const code = generateActivationCode('KABAMBA', 'Patrick');
    expect(code).toHaveLength(8);
  });

  it('devrait commencer par les 2 initiales majuscules (nom + prénom)', () => {
    const code = generateActivationCode('kabamba', 'patrick');
    expect(code.startsWith('KP')).toBe(true);
  });

  it('devrait être conforme au schéma Zod accessCodeSchema de @meal-app/shared', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateActivationCode('MUTOMBO', 'Jean');
      const parseResult = accessCodeSchema.safeParse(code);
      expect(parseResult.success).toBe(true);
    }
  });

  it('devrait gérer les accents et caractères spéciaux pour les initiales', () => {
    // Éléonore -> E, Àlex -> A
    const code = generateActivationCode('Émile', 'Noël');
    expect(code).toHaveLength(8);
    // Le premier caractère doit être une lettre majuscule
    expect(/^[A-Z]{2}/.test(code)).toBe(true);
  });

  it('devrait produire des codes uniques à chaque génération', () => {
    const generated = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateActivationCode('LUKUSA', 'David');
      generated.add(code);
    }
    // Avec 62^6 combinaisons possibles, les 50 doivent être uniques
    expect(generated.size).toBe(50);
  });
});
