/**
 * Client HTTP de l'API : ajoute le jeton, décode les erreurs et signale les sessions expirées.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'yf-token';

/** Erreur renvoyée par l'API, avec son code HTTP et ses détails éventuels */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Code métier éventuel (ex. « ABONNEMENT_NON_COMMENCE ») */
  get code(): string | undefined {
    const details = this.details as { code?: unknown } | undefined;
    return typeof details?.code === 'string' ? details.code : undefined;
  }

  /** Premier message de validation d'un champ, s'il y en a */
  fieldMessage(field: string): string | undefined {
    if (!Array.isArray(this.details)) return undefined;
    const issue = (this.details as { field?: string; message?: string }[]).find((d) => d.field === field);
    return issue?.message;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible : la session ne survivra pas au rechargement
  }
}

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

/** Appelé quand l'API répond 401 alors qu'un jeton était envoyé (session expirée ou fermée) */
export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  onUnauthorized = listener;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Connexion impossible. Vérifie ton réseau et réessaie.', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as { error?: string; details?: unknown } | null;

  if (!response.ok) {
    if (response.status === 401 && token) {
      onUnauthorized?.();
    }
    throw new ApiError(body?.error ?? `Erreur ${response.status}`, response.status, body?.details);
  }

  return body as T;
}

export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

const json = (body: unknown): RequestInit['body'] => JSON.stringify(body);

export const http = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: body === undefined ? undefined : json(body) }),
  put: <T>(endpoint: string, body: unknown) => apiFetch<T>(endpoint, { method: 'PUT', body: json(body) }),
  patch: <T>(endpoint: string, body: unknown) => apiFetch<T>(endpoint, { method: 'PATCH', body: json(body) }),
  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
};
