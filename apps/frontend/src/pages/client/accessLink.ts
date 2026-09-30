/**
 * Accès transmis par lien ou QR code (« …/bienvenue#code=…&nom=… »).
 * Le code est lu dans la partie après le « # » (jamais envoyée au serveur), gardé le temps de la
 * première connexion dans la session du navigateur, puis retiré de la barre d'adresse.
 */

const STORAGE_KEY = 'yf-acces';

export interface PendingAccess {
  code: string;
  nom: string;
}

export function parseAccessFragment(hash: string): PendingAccess | null {
  const fragment = hash.replace(/^#/, '');
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const code = params.get('code') ?? (fragment.includes('=') ? '' : decodeURIComponent(fragment));
  if (!code) return null;
  return { code, nom: params.get('nom') ?? '' };
}

export function storePendingAccess(access: PendingAccess): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch {
    // Stockage indisponible : le client saisira son code à la main
  }
}

export function readPendingAccess(): PendingAccess | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAccess) : null;
  } catch {
    return null;
  }
}

export function clearPendingAccess(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // rien à nettoyer
  }
}
