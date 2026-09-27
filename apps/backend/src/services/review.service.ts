/**
 * Service Métier : Avis et notation (SPEC 5.9).
 * Conforme à AG_RULES.md.
 */

import { SubmitReviewDto } from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class ReviewService {
  /** Soumission d'un avis par le client (SPEC 5.9) */
  async submitReview(subscriptionId: number, dto: SubmitReviewDto): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundError('Commande introuvable');
    }

    if (order.subscriptionId !== subscriptionId) {
      throw new BadRequestError('Cette commande ne vous appartient pas');
    }

    // Upsert de l'avis
    const existing = await prisma.review.findUnique({
      where: { orderId: dto.orderId },
    });

    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          noteEtoile: dto.noteEtoile ?? existing.noteEtoile,
          commentaire: dto.commentaire?.trim() ?? existing.commentaire,
          rempli: true,
        },
      });
    } else {
      await prisma.review.create({
        data: {
          orderId: dto.orderId,
          noteEtoile: dto.noteEtoile ?? null,
          commentaire: dto.commentaire?.trim() ?? null,
          rempli: true,
        },
      });
    }
  }

  /** Flux global des avis (admin) — du plus récent au plus ancien (SPEC 6) */
  async getAllReviews(): Promise<{
    orderId: number;
    clientNom: string;
    clientPrenom: string;
    date: string;
    noteEtoile: number | null;
    commentaire: string | null;
  }[]> {
    const reviews = await prisma.review.findMany({
      where: { rempli: true },
      include: {
        order: {
          include: {
            dailyOffer: true,
            subscription: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      orderId: r.orderId,
      clientNom: r.order.subscription.user.nom,
      clientPrenom: r.order.subscription.user.prenom,
      date: r.order.dailyOffer.date.toISOString().split('T')[0],
      noteEtoile: r.noteEtoile,
      commentaire: r.commentaire,
    }));
  }
}

export const reviewService = new ReviewService();
