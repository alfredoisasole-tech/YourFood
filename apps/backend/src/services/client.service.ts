/**
 * Service Métier : Gestion des Clients et Abonnements (côté Admin).
 * Conforme à SPEC.md (5.1, 5.2, 5.3, 5.11 & 6) et AG_RULES.md.
 */

import {
  CreateClientDto,
  CreateClientResponse,
  ResetPasswordResponse,
  RenewSubscriptionDto,
  ClientDetailView,
  SubscriptionPlan,
  SubscriptionStatus,
  Role,
  OrderStatus,
} from '@meal-app/shared';
import { Formule, StatutAbonnement, AccessCodeType, User, Subscription } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { userRepository } from '../repositories/user.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { accessCodeRepository } from '../repositories/accessCode.repository';
import { generateActivationCode } from '../utils/codeGenerator';
import {
  calculateSubscriptionEndDate,
  nowKinshasa,
  getTodayDateString,
} from '../utils/time';
import {
  buildActivationWhatsAppUrl,
  buildResetPasswordWhatsAppUrl,
} from '../utils/whatsapp';
import { NotFoundError, ConflictError } from '../utils/errors';
import dayjs from 'dayjs';

export class ClientService {
  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173';
  }

  private mapFormuleToPrisma(plan: SubscriptionPlan): Formule {
    return plan === SubscriptionPlan.PLAN_35000 ? Formule.F_35000 : Formule.F_25000;
  }

  private mapFormuleToShared(formule: Formule): SubscriptionPlan {
    return formule === Formule.F_35000 ? SubscriptionPlan.PLAN_35000 : SubscriptionPlan.PLAN_25000;
  }

  /**
   * Inscription d'un nouveau client (100% côté admin).
   * SPEC 5.1 & 5.2.
   */
  async createClient(dto: CreateClientDto): Promise<CreateClientResponse> {
    // Vérifier l'unicité du numéro de téléphone
    const existingPhone = await userRepository.findByTelephone(dto.telephone);
    if (existingPhone) {
      throw new ConflictError('Un client existe déjà avec ce numéro de téléphone');
    }

    const dateDebut = dayjs(dto.dateDebut).toDate();
    const dateFinStr = calculateSubscriptionEndDate(dto.dateDebut, dto.dureeJours);
    const dateFin = dayjs(dateFinStr).toDate();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Création de l'utilisateur
      const user = await tx.user.create({
        data: {
          nom: dto.nom.trim(),
          prenom: dto.prenom.trim(),
          telephone: dto.telephone.trim(),
          role: 'client',
        },
      });

      // 2. Création de l'abonnement
      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          formule: this.mapFormuleToPrisma(dto.formule),
          dateDebut,
          dateFin,
          bonus: dto.bonus?.trim() || null,
          statut: StatutAbonnement.actif,
        },
      });

      // 3. Génération du code d'activation unique à 8 caractères
      let code = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        code = generateActivationCode(user.nom, user.prenom);
        const existing = await tx.accessCode.findUnique({ where: { code } });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error('Impossible de générer un code d\'accès unique');
      }

      await tx.accessCode.create({
        data: {
          subscriptionId: subscription.id,
          code,
          type: AccessCodeType.activation,
          utilise: false,
        },
      });

      return { user, subscription, code };
    });

    const activationLink = `${this.getFrontendUrl()}/activation?code=${result.code}&nom=${encodeURIComponent(result.user.nom)}`;
    const whatsappUrl = buildActivationWhatsAppUrl(
      result.user.telephone,
      result.user.prenom,
      result.code,
      activationLink
    );

    return {
      client: {
        id: result.user.id,
        nom: result.user.nom,
        prenom: result.user.prenom,
        telephone: result.user.telephone,
        role: Role.CLIENT,
        createdAt: result.user.createdAt.toISOString(),
      },
      subscription: {
        id: result.subscription.id,
        userId: result.subscription.userId,
        formule: this.mapFormuleToShared(result.subscription.formule),
        dateDebut: dayjs(result.subscription.dateDebut).format('YYYY-MM-DD'),
        dateFin: dayjs(result.subscription.dateFin).format('YYYY-MM-DD'),
        bonus: result.subscription.bonus,
        statut: SubscriptionStatus.ACTIF,
        createdAt: result.subscription.createdAt.toISOString(),
      },
      accessCode: result.code,
      activationLink,
      whatsappUrl,
    };
  }

  /**
   * Réinitialisation de mot de passe oublié initiée par l'admin depuis la fiche client.
   * SPEC 5.3.
   */
  async resetPassword(subscriptionId: number): Promise<ResetPasswordResponse> {
    const subscription = await subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Abonnement introuvable');
    }

    const user = await userRepository.findById(subscription.userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable');
    }

    const code = generateActivationCode(user.nom, user.prenom);

    await accessCodeRepository.create({
      subscriptionId: subscription.id,
      code,
      type: AccessCodeType.reinitialisation,
    });

    const resetLink = `${this.getFrontendUrl()}/activation?code=${code}&nom=${encodeURIComponent(user.nom)}`;
    const whatsappUrl = buildResetPasswordWhatsAppUrl(
      user.telephone,
      user.prenom,
      code,
      resetLink
    );

    return {
      code,
      whatsappUrl,
    };
  }

  /**
   * Renouvellement ou prolongation d'abonnement par l'admin.
   * Conserve l'historique et ne régénère pas de code ni de lien (SPEC 5.11).
   */
  async renewSubscription(
    subscriptionId: number,
    dto: RenewSubscriptionDto
  ): Promise<Subscription> {
    const currentSub = await subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new NotFoundError('Abonnement à renouveler introuvable');
    }

    const now = nowKinshasa();
    const currentEnd = dayjs(currentSub.dateFin);

    // Si l'abonnement actuel n'est pas encore expiré, on démarre le jour suivant sa fin
    let newStartDate = now.startOf('day');
    if (currentEnd.isAfter(now)) {
      newStartDate = currentEnd.add(1, 'day').startOf('day');
    }

    const newEndDateStr = calculateSubscriptionEndDate(
      newStartDate.format('YYYY-MM-DD'),
      dto.dureeJours
    );
    const newEndDate = dayjs(newEndDateStr).toDate();

    const newFormule = dto.formule
      ? this.mapFormuleToPrisma(dto.formule)
      : currentSub.formule;

    return prisma.$transaction(async (tx) => {
      // 1. Marquer l'ancien abonnement comme expiré
      await tx.subscription.update({
        where: { id: currentSub.id },
        data: { statut: StatutAbonnement.expire },
      });

      // 2. Créer la nouvelle période
      return tx.subscription.create({
        data: {
          userId: currentSub.userId,
          formule: newFormule,
          dateDebut: newStartDate.toDate(),
          dateFin: newEndDate,
          bonus: currentSub.bonus,
          statut: StatutAbonnement.actif,
        },
      });
    });
  }

  /**
   * Récupère la liste de tous les clients avec leur abonnement actuel.
   * SPEC 6 (Écran Clients).
   */
  async getAllClients(): Promise<User[]> {
    return userRepository.findAllClients();
  }

  /**
   * Vue détaillée d'un client avec ses 3 onglets (Infos, Historique, Avis).
   * SPEC 6.
   */
  async getClientDetail(userId: number): Promise<ClientDetailView> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Client introuvable');
    }

    const subscriptions = await subscriptionRepository.findHistoryByUserId(userId);
    const activeSub = subscriptions.find((s) => s.statut === StatutAbonnement.actif);

    let joursRestants = 0;
    if (activeSub) {
      const today = dayjs(getTodayDateString());
      const end = dayjs(activeSub.dateFin);
      joursRestants = Math.max(0, end.diff(today, 'day'));
    }

    // Récupération des commandes passées
    const orders = await prisma.order.findMany({
      where: { subscription: { userId } },
      include: {
        dailyOffer: true,
        plat: { include: { catalogItem: true } },
        accompagnement: { include: { catalogItem: true } },
        viande: { include: { catalogItem: true } },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const reviews = orders
      .filter((o) => o.review && o.review.rempli)
      .map((o) => ({
        orderId: o.id,
        date: dayjs(o.dailyOffer.date).format('YYYY-MM-DD'),
        noteEtoile: o.review?.noteEtoile,
        commentaire: o.review?.commentaire,
      }));

    const notes = reviews.map((r) => r.noteEtoile).filter((n): n is number => n !== null && n !== undefined);
    const noteMoyenne = notes.length > 0 ? Number((notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1)) : null;

    return {
      client: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        role: Role.CLIENT,
        createdAt: user.createdAt.toISOString(),
      },
      abonnementActif: activeSub
        ? {
            id: activeSub.id,
            userId: activeSub.userId,
            formule: this.mapFormuleToShared(activeSub.formule),
            dateDebut: dayjs(activeSub.dateDebut).format('YYYY-MM-DD'),
            dateFin: dayjs(activeSub.dateFin).format('YYYY-MM-DD'),
            bonus: activeSub.bonus,
            statut: SubscriptionStatus.ACTIF,
            createdAt: activeSub.createdAt.toISOString(),
          }
        : null,
      joursRestants,
      historiqueAbonnements: subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        formule: this.mapFormuleToShared(s.formule),
        dateDebut: dayjs(s.dateDebut).format('YYYY-MM-DD'),
        dateFin: dayjs(s.dateFin).format('YYYY-MM-DD'),
        bonus: s.bonus,
        statut: s.statut === StatutAbonnement.actif ? SubscriptionStatus.ACTIF : SubscriptionStatus.EXPIRE,
        createdAt: s.createdAt.toISOString(),
      })),
      historiqueJours: orders.map((o) => ({
        date: dayjs(o.dailyOffer.date).format('YYYY-MM-DD'),
        platNom: o.plat.catalogItem.nom,
        accompagnementNom: o.accompagnement.catalogItem.nom,
        viandeNom: o.viande?.catalogItem.nom ?? null,
        statut: o.statut as unknown as OrderStatus,
        estDefaut: o.estDefaut,
      })),
      avis: reviews,
      noteMoyenne,
    };
  }
}

export const clientService = new ClientService();
