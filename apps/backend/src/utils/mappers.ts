/**
 * Conversions entre les modèles Prisma et les types partagés exposés par l'API.
 */

import { Formule, Subscription as PrismaSubscription, User as PrismaUser } from '@prisma/client';
import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionView,
  User,
  getSubscriptionState,
  periodWeeks,
  subscriptionTotalFc,
} from '@meal-app/shared';
import { fromDbDate } from './time';

export function toSharedFormule(formule: Formule): SubscriptionPlan {
  return formule === Formule.F_35000 ? SubscriptionPlan.PLAN_35000 : SubscriptionPlan.PLAN_25000;
}

export function toPrismaFormule(plan: SubscriptionPlan): Formule {
  return plan === SubscriptionPlan.PLAN_35000 ? Formule.F_35000 : Formule.F_25000;
}

export function toUser(user: PrismaUser): User {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    telephone: user.telephone,
    role: user.role as unknown as Role,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Abonnement enrichi de son état, calculé à partir des dates et non du champ `statut`
 * (personne ne bascule ce champ à l'échéance).
 */
export function toSubscriptionView(sub: PrismaSubscription, todayIso: string): SubscriptionView {
  const period = { dateDebut: fromDbDate(sub.dateDebut), dateFin: fromDbDate(sub.dateFin) };
  const { etat, joursRestants } = getSubscriptionState(period, todayIso);
  const formule = toSharedFormule(sub.formule);
  const dureeSemaines = periodWeeks(period);

  return {
    id: sub.id,
    userId: sub.userId,
    formule,
    dateDebut: period.dateDebut,
    dateFin: period.dateFin,
    bonus: sub.bonus,
    statut: sub.statut as unknown as SubscriptionStatus,
    createdAt: sub.createdAt.toISOString(),
    etat,
    joursRestants,
    dureeSemaines,
    totalFc: subscriptionTotalFc(formule, dureeSemaines),
  };
}
