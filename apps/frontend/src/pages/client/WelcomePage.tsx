/**
 * Écran « Bienvenue » : grande photo, logo blanc, accès à la connexion.
 */

import { Link, Navigate } from 'react-router-dom';
import { Role } from '@meal-app/shared';
import { useAuth } from '../../features/auth/AuthContext';
import { Logo } from '../../components/ui/Controls';

export function WelcomePage() {
  const { status, user } = useAuth();

  if (status === 'authenticated' && user) {
    return <Navigate to={user.role === Role.ADMIN ? '/admin' : '/menu'} replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#12301F] dark:bg-black">
      <img
        src="/images/photo-accueil.jpg"
        alt="Pâtes fraîches aux herbes"
        className="a-drift absolute inset-0 h-full w-full object-cover object-[50%_30%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,38,24,0.7)_0%,rgba(10,38,24,0.42)_38%,rgba(10,38,24,0.55)_62%,rgba(10,38,24,0.88)_100%)] dark:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.2)_40%,rgba(0,0,0,0.45)_65%,rgba(0,0,0,0.85)_100%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-7 pb-9 pt-10">
        <div className="a-rise d1">
          <Logo variant="white" height={72} />
        </div>
        <div className="mt-14 flex flex-col gap-3">
          <h1 className="a-rise d2 font-serif text-[60px] leading-none tracking-[-0.01em] text-white">Bienvenue.</h1>
          <p className="a-rise d3 text-lg leading-snug text-white/90">Chaque midi, un repas pensé pour toi.</p>
        </div>
        <div className="flex-1" />
        <Link
          to="/connexion"
          className="a-rise d5 press flex h-[58px] w-full items-center justify-center rounded-full border border-white/40 bg-white/20 text-[17px] font-semibold text-white backdrop-blur-xl"
        >
          Se connecter
        </Link>
        <Link
          to="/premiere-connexion"
          className="a-rise d6 mt-1.5 flex min-h-12 items-center justify-center text-[15px] font-medium text-white/90"
        >
          Première fois ? Entre avec ton code
        </Link>
      </div>
    </div>
  );
}
