/**
 * Page d'arrivée du lien d'accès et du QR code : mémorise le code puis ouvre la première connexion.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAccessFragment, storePendingAccess } from './accessLink';
import { FullPageLoader } from '../../components/ui/States';

export function AccessLinkPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const access = parseAccessFragment(window.location.hash);
    if (access) storePendingAccess(access);
    // Retire le code de la barre d'adresse et de l'historique du navigateur
    window.history.replaceState(null, '', window.location.pathname);
    navigate('/premiere-connexion', { replace: true });
  }, [navigate]);

  return <FullPageLoader />;
}
