import React from 'react';

export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <header className="bg-white border-b border-stone-200 px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label="plat">🍲</span>
            <span className="font-extrabold text-xl tracking-tight text-orange-600">YourFood</span>
          </div>
          <span className="text-xs bg-orange-100 text-orange-800 font-semibold px-2.5 py-1 rounded-full">
            Kinshasa
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
          <div className="text-4xl mb-4" role="img" aria-label="repas">🍽️</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Bienvenue sur YourFood</h1>
          <p className="text-stone-600 mb-6 text-sm">
            Service d'abonnement de repas au quotidien. Commandez votre menu de midi préparé avec soin.
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-stone-50 rounded-xl text-left border border-stone-100">
              <span className="font-semibold text-xs text-stone-500 uppercase tracking-wider block mb-1">
                Espace Client
              </span>
              <p className="text-xs text-stone-600">
                Activez votre abonnement avec votre code à 8 caractères ou connectez-vous.
              </p>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl text-left border border-stone-100">
              <span className="font-semibold text-xs text-stone-500 uppercase tracking-wider block mb-1">
                Espace Cuisine & Admin
              </span>
              <p className="text-xs text-stone-600">
                Suivi de préparation en direct et gestion des abonnements.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-200 py-4 text-center text-xs text-stone-500">
        &copy; {new Date().getFullYear()} YourFood — Tous droits réservés.
      </footer>
    </div>
  );
}

export default App;
