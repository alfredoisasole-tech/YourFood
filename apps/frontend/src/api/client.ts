// API — ce dossier contiendra les fonctions d'appel à l'API backend.
// Chaque fichier correspond à un domaine : auth.ts, offers.ts, orders.ts, etc.
// Utiliser fetch ou un client HTTP typé.

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

/**
 * Fonction utilitaire pour les appels API avec gestion d'erreurs.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Erreur inconnue' }));
    throw new Error(errorBody.message ?? `Erreur HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
