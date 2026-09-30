/**
 * Routes de l'application : espace client (mobile) et espace administratrice.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Role } from '@meal-app/shared';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireRole } from './features/auth/RequireRole';
import { ToastProvider } from './components/ui/Toast';
import { WelcomePage } from './pages/client/WelcomePage';
import { LoginPage } from './pages/client/LoginPage';
import { FirstLoginPage } from './pages/client/FirstLoginPage';
import { AccessLinkPage } from './pages/client/AccessLinkPage';
import { ClientArea } from './pages/client/ClientArea';
import { MenuPage } from './pages/client/MenuPage';
import { HistoryPage } from './pages/client/HistoryPage';
import { AccountPage } from './pages/client/AccountPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminArea } from './pages/admin/AdminArea';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { StatsPage } from './pages/admin/StatsPage';
import { TrackingPage } from './pages/admin/TrackingPage';
import { ClientsPage } from './pages/admin/ClientsPage';
import { ClientDetailPage } from './pages/admin/ClientDetailPage';
import { CatalogPage } from './pages/admin/CatalogPage';
import { MenusPage } from './pages/admin/MenusPage';
import { ReviewsPage } from './pages/admin/ReviewsPage';
import { AdminAccountPage } from './pages/admin/AdminAccountPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Espace client */}
      <Route path="/" element={<WelcomePage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/premiere-connexion" element={<FirstLoginPage />} />
      <Route path="/bienvenue" element={<AccessLinkPage />} />
      <Route
        element={
          <RequireRole role={Role.CLIENT}>
            <ClientArea />
          </RequireRole>
        }
      >
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/historique" element={<HistoryPage />} />
        <Route path="/compte" element={<AccountPage />} />
      </Route>

      {/* Espace administratrice */}
      <Route path="/admin/connexion" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireRole role={Role.ADMIN}>
            <AdminArea />
          </RequireRole>
        }
      >
        <Route index element={<AdminHomePage />} />
        <Route path="statistiques" element={<StatsPage />} />
        <Route path="suivi" element={<TrackingPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="carte" element={<CatalogPage />} />
        <Route path="menus" element={<MenusPage />} />
        <Route path="avis" element={<ReviewsPage />} />
        <Route path="compte" element={<AdminAccountPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
