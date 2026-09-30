/**
 * Messages de confirmation éphémères (« C'est noté », « Code copié »).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastContextValue {
  show: (message: string, tone?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'success' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className="a-drop flex max-w-[360px] items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-page shadow-nav"
          >
            <span className={toast.tone === 'success' ? 'text-nav-pill' : 'text-danger'}>
              <Icon name={toast.tone === 'success' ? 'check' : 'info'} size={18} strokeWidth={2.2} />
            </span>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans ToastProvider');
  return context;
}
