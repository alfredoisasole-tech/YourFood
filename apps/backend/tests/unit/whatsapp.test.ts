import { describe, it, expect } from 'vitest';
import {
  buildAccessDelivery,
  buildAccessLink,
  buildWelcomeMessage,
  buildWhatsAppUrl,
  formatCodeForDisplay,
  formatDateFr,
} from '../../src/utils/whatsapp';

describe('Accès client : lien, code et message WhatsApp (SPEC 5.2)', () => {
  it('place le code et le nom après le « # » : ils ne sont jamais envoyés au serveur', () => {
    const lien = 'https://yourfood.app/bienvenue#code=RN7Q3M8K&nom=Ruth+Ngoy';
    expect(buildAccessLink('https://yourfood.app', 'RN7Q3M8K', 'Ruth Ngoy')).toBe(lien);
    expect(buildAccessLink('https://yourfood.app/', 'RN7Q3M8K', 'Ruth Ngoy')).toBe(lien);
  });

  it('groupe le code par 4 pour la lecture', () => {
    expect(formatCodeForDisplay('RN7Q3M8K')).toBe('RN7Q 3M8K');
  });

  it('formate la date de début en français', () => {
    expect(formatDateFr('2026-10-05')).toBe('lundi 5 octobre');
  });

  it('reprend le texte de la maquette dans le message de bienvenue', () => {
    const message = buildWelcomeMessage({
      prenom: 'Ruth',
      dateDebut: '2026-10-05',
      lien: 'https://yourfood.app/bienvenue#RN7Q3M8K',
      code: 'RN7Q3M8K',
    });
    expect(message).toContain('Bonjour Ruth,');
    expect(message).toContain('Dès le lundi 5 octobre');
    expect(message).toContain('https://yourfood.app/bienvenue#RN7Q3M8K');
    expect(message).toContain('Ton code d\'accès : RN7Q 3M8K');
  });

  it('ne fournit pas de lien WhatsApp sans numéro de téléphone (numéro facultatif)', () => {
    expect(buildWhatsAppUrl(null, 'Bonjour')).toBeNull();
  });

  it('fournit le lien wa.me avec le message encodé quand il y a un numéro', () => {
    const url = buildWhatsAppUrl('+243812345678', 'Bonjour Ruth');
    expect(url).toBe('https://wa.me/243812345678?text=Bonjour%20Ruth');
  });

  it('livre lien, code et message même sans numéro, pour l\'affichage en QR code', () => {
    const delivery = buildAccessDelivery({
      telephone: null,
      code: 'RN7Q3M8K',
      identifiant: 'Ruth Ngoy',
      frontendUrl: 'https://yourfood.app',
      message: (lien) => `Ouvre ${lien}`,
    });
    expect(delivery.whatsappUrl).toBeNull();
    expect(delivery.lien).toBe('https://yourfood.app/bienvenue#code=RN7Q3M8K&nom=Ruth+Ngoy');
    expect(delivery.codeAffichage).toBe('RN7Q 3M8K');
  });
});
