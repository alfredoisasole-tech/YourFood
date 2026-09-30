import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../src/App';
import { ThemeProvider } from '../src/lib/theme';
import { ToastProvider } from '../src/components/ui/Toast';
import { AuthProvider } from '../src/features/auth/AuthContext';

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('Frontend : parcours sans session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('affiche l\'écran de bienvenue de la maquette', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Bienvenue.' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Première fois ? Entre avec ton code' })).toBeDefined();
  });

  it('renvoie vers la connexion quand on ouvre le menu sans être connecté', () => {
    renderAt('/menu');
    expect(screen.getByRole('heading', { name: 'Bon retour.' })).toBeDefined();
  });

  it('protège l\'espace admin', () => {
    renderAt('/admin/clients');
    expect(screen.getByText("Accès réservé à l'administratrice.")).toBeDefined();
  });
});
