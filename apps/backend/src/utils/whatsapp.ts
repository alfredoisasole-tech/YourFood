/**
 * Messages d'accès et liens WhatsApp (Web & mobile).
 * Conforme à SPEC.md (5.2 & 5.3). Les textes reprennent ceux de la maquette.
 */

import { AccessDelivery } from '@meal-app/shared';

/** Nettoie le numéro pour wa.me (chiffres uniquement, sans le '+') */
export function formatPhoneForWhatsApp(telephone: string): string {
  return telephone.replace(/\D/g, '');
}

/** Code groupé par 4 pour la lecture : « RN7Q3M8K » devient « RN7Q 3M8K » */
export function formatCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/**
 * Lien de connexion. Le code et le nom sont placés après le « # » : cette partie de l'adresse n'est
 * jamais transmise au serveur (donc absente de ses journaux) et la page la retire de la barre
 * d'adresse. Le nom pré-remplit le formulaire : le client n'a plus qu'à choisir son mot de passe.
 */
export function buildAccessLink(frontendUrl: string, code: string, identifiant: string): string {
  const fragment = new URLSearchParams({ code, nom: identifiant }).toString();
  return `${frontendUrl.replace(/\/+$/, '')}/bienvenue#${fragment}`;
}

/** « 2026-10-05 » devient « lundi 5 octobre » */
export function formatDateFr(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00.000Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function buildWelcomeMessage(params: {
  prenom: string;
  dateDebut: string;
  lien: string;
  code: string;
}): string {
  return [
    `Bonjour ${params.prenom},`,
    `Bienvenue à table chez Your Food ! Dès le ${formatDateFr(params.dateDebut)}, un repas fait maison t'attend chaque midi, du lundi au vendredi.`,
    'Pour entrer, ouvre ton lien :',
    params.lien,
    `Ton code d'accès : ${formatCodeForDisplay(params.code)}`,
    'Tu choisiras ensuite ton mot de passe, et le tour est joué. Bon appétit !',
  ].join('\n');
}

export function buildResetMessage(params: { prenom: string; lien: string; code: string }): string {
  return [
    `Bonjour ${params.prenom},`,
    'Voici ton nouvel accès Your Food pour choisir un nouveau mot de passe.',
    'Ouvre ton lien :',
    params.lien,
    `Ton code d'accès : ${formatCodeForDisplay(params.code)}`,
    "Ce code ne sert qu'une seule fois.",
  ].join('\n');
}

/** Lien WhatsApp avec message pré-rempli ; null si le client n'a pas de numéro */
export function buildWhatsAppUrl(telephone: string | null, message: string): string | null {
  if (!telephone) {
    return null;
  }
  return `https://wa.me/${formatPhoneForWhatsApp(telephone)}?text=${encodeURIComponent(message)}`;
}

/** Assemble tout ce dont l'admin a besoin pour transmettre un accès */
export function buildAccessDelivery(params: {
  telephone: string | null;
  code: string;
  /** « Prénom Nom » du client */
  identifiant: string;
  frontendUrl: string;
  message: (lien: string) => string;
}): AccessDelivery {
  const lien = buildAccessLink(params.frontendUrl, params.code, params.identifiant);
  const message = params.message(lien);
  return {
    code: params.code,
    codeAffichage: formatCodeForDisplay(params.code),
    lien,
    whatsappUrl: buildWhatsAppUrl(params.telephone, message),
    message,
  };
}
