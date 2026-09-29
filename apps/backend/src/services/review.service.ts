/**
 * Service Métier : Avis et notation des repas.
 * Conforme à SPEC.md (5.9, 6) et AG_RULES.md.
 */

import { StatutCommande, StatutOffre } from '@prisma/client';
import { SubmitReviewDto, AdminReviewView } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { fromDbDate } from '../utils/time';
import { mealLabel } from '../utils/orderFormat';
import { BadRequestError, NotFoundError } from '../utils/errors';

export class ReviewService {
  /**
   * Avis d'un client sur un de ses repas (SPEC 5.9) : facultatif, note et/ou commentaire.
   * Possible sur n'importe quel repas déjà servi (y compris d'une période d'abonnement précédente),
   * pas sur un repas annulé ni sur celui du jour.
   */
  async submitReview(userId: number, dto: SubmitReviewDto): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { subscription: true, dailyOffer: true },
    });

    if (order?.subscription.userId !== userId) {
      throw new NotFoundError('Commande introuvable');
    }
    if (order.statut === StatutCommande.annulee) {
      throw new BadRequestError('Ce repas a été annulé : il n\'y a rien à noter.');
    }
    if (order.dailyOffer.statut !== StatutOffre.verrouille) {
      throw new BadRequestError('Tu pourras donner ton avis une fois le repas servi.');
    }

    await prisma.review.upsert({
      where: { orderId: dto.orderId },
      create: {
        orderId: dto.orderId,
        noteEtoile: dto.noteEtoile ?? null,
        commentaire: dto.commentaire ?? null,
        rempli: true,
      },
      update: {
        ...(dto.noteEtoile !== undefined ? { noteEtoile: dto.noteEtoile } : {}),
        ...(dto.commentaire !== undefined ? { commentaire: dto.commentaire } : {}),
        rempli: true,
      },
    });
  }

  /** Flux global des avis (admin) — du plus récent au plus ancien (SPEC 6) */
  async getAllReviews(): Promise<AdminReviewView[]> {
    const reviews = await prisma.review.findMany({
      where: { rempli: true },
      include: {
        order: {
          include: {
            dailyOffer: true,
            subscription: { include: { user: true } },
            plat: { include: { catalogItem: true } },
            accompagnement: { include: { catalogItem: true } },
            viande: { include: { catalogItem: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      reviewId: r.id,
      clientNom: r.order.subscription.user.nom,
      clientPrenom: r.order.subscription.user.prenom,
      date: fromDbDate(r.order.dailyOffer.date),
      noteEtoile: r.noteEtoile,
      commentaire: r.commentaire,
      repas: mealLabel(r.order),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export const reviewService = new ReviewService();
