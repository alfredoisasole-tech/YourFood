import { describe, it, expect } from 'vitest';
import { formatCountdown, formatFc, formatPhone, formatTime, initials, kinshasaClock } from '../src/lib/format';
import { upcomingMondays, workingDays } from '../src/lib/calendar';
import { parseAccessFragment } from '../src/pages/client/accessLink';

describe('Mise en forme', () => {
  it('formate les montants, heures et numéros comme la maquette', () => {
    expect(formatFc(280000)).toBe('280 000 FC');
    expect(formatTime('13:00')).toBe('13h00');
    expect(formatPhone('+243812345678')).toBe('+243 81 234 5678');
    expect(initials('Mireille', 'Kabongo')).toBe('MK');
    expect(formatCountdown(34915)).toBe('09:41:55');
  });

  it('donne la date et l\'heure de Kinshasa (UTC+1)', () => {
    expect(kinshasaClock(new Date('2026-09-29T23:30:00Z'))).toEqual({ date: '2026-09-30', seconds: 30 * 60 });
  });
});

describe('Calendrier', () => {
  it('propose les lundis à venir, dont aujourd\'hui si c\'est un lundi', () => {
    expect(upcomingMondays('2026-09-28', 2)).toEqual(['2026-09-28', '2026-10-05']);
    expect(upcomingMondays('2026-09-30', 2)).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('saute le week-end', () => {
    expect(workingDays('2026-10-01', 3)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);
  });
});

describe('Lien d\'accès', () => {
  it('lit le code et le nom après le « # »', () => {
    expect(parseAccessFragment('#code=RN7Q3M8K&nom=Ruth+Ngoy')).toEqual({ code: 'RN7Q3M8K', nom: 'Ruth Ngoy' });
    expect(parseAccessFragment('#RN7Q3M8K')).toEqual({ code: 'RN7Q3M8K', nom: '' });
    expect(parseAccessFragment('')).toBeNull();
  });
});
