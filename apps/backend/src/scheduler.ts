/**
 * Tâche planifiée : verrouillage automatique des menus à 20h00 (heure de Kinshasa) et attribution
 * des commandes par défaut (SPEC 5.8).
 *
 * Le verrouillage est aussi déclenché à la lecture (menu client, suivi admin) : cette tâche garantit
 * qu'il a lieu même si personne ne consulte l'application, et rattrape un menu resté ouvert après
 * une interruption du serveur. L'opération est idempotente : l'exécuter plusieurs fois est sans danger.
 */

import { orderService } from './services/order.service';

const CHECK_INTERVAL_MS = 60 * 1000;

async function runLockCheck(): Promise<void> {
  try {
    const locked = await orderService.lockDueOffers();
    if (locked > 0) {
      // eslint-disable-next-line no-console
      console.log(`🔒 ${locked} menu(s) verrouillé(s), commandes par défaut attribuées`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('💥 Échec du verrouillage automatique :', err);
  }
}

/** Démarre la vérification (immédiate puis chaque minute) et retourne le minuteur pour l'arrêter */
export function startLockScheduler(): NodeJS.Timeout {
  void runLockCheck();
  const timer = setInterval(() => void runLockCheck(), CHECK_INTERVAL_MS);
  timer.unref();
  return timer;
}
