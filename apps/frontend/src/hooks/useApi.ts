/**
 * Chargement de données depuis l'API avec états de chargement et d'erreur.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** Recharge les données ; `silent` garde l'affichage courant pendant le chargement */
  reload: (silent?: boolean) => Promise<void>;
  setData: (updater: T | null | ((current: T | null) => T | null)) => void;
}

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError('Une erreur inattendue est survenue.', 0);
}

/**
 * Exécute `fetcher` au montage et à chaque changement de `deps`.
 * Les réponses arrivées après un changement de paramètres sont ignorées.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === requestId.current) setError(toApiError(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Relance `callback` toutes les `intervalMs` millisecondes tant que la page est visible */
export function usePolling(callback: () => void, intervalMs: number, enabled = true): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') callbackRef.current();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
}

/** Horloge qui se met à jour chaque seconde */
export function useTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Enveloppe une action (envoi de formulaire) avec son état d'envoi et son erreur */
export function useAction<Args extends unknown[], R>(action: (...args: Args) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        setError(toApiError(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [action]
  );

  return { run, pending, error, setError };
}
