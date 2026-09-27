/**
 * Service Métier : Authentification & Sessions.
 * Conforme à SPEC.md (5.3 & 7) et AG_RULES.md.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  FirstLoginDto,
  LoginDto,
  ChangePasswordDto,
  AuthResponse,
  Role,
  SubscriptionStatus,
  SubscriptionPlan,
} from '@meal-app/shared';
import { userRepository } from '../repositories/user.repository';
import { accessCodeRepository } from '../repositories/accessCode.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors';
import { nowKinshasa } from '../utils/time';
import dayjs from 'dayjs';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

export class AuthService {
  private generateToken(payload: {
    userId: number;
    nom: string;
    role: Role;
    subscriptionId?: number;
  }): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET manquant dans la configuration');
    }
    return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Première connexion : nom + code à 8 caractères -> création du mot de passe.
   * SPEC 5.3 & 7.
   */
  async firstLogin(dto: FirstLoginDto): Promise<AuthResponse> {
    const codeRecord = await accessCodeRepository.findByCode(dto.code);

    if (!codeRecord || codeRecord.utilise) {
      throw new BadRequestError('Code d\'activation invalide ou déjà utilisé');
    }

    // Récupération de l'abonnement et de l'utilisateur rattaché
    const subscription = await subscriptionRepository.findById(codeRecord.subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Abonnement introuvable pour ce code');
    }

    const user = await userRepository.findById(subscription.userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable');
    }

    // Vérification du nom
    if (user.nom.trim().toLowerCase() !== dto.nom.trim().toLowerCase()) {
      throw new BadRequestError('Le nom ne correspond pas à ce code d\'activation');
    }

    // Hachage du nouveau mot de passe
    const hash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);

    // Mise à jour du mot de passe utilisateur
    await userRepository.updatePassword(user.id, hash);

    // Marquage du code comme utilisé
    await accessCodeRepository.markAsUsed(codeRecord.id);

    // Émission du token JWT
    const token = this.generateToken({
      userId: user.id,
      nom: user.nom,
      role: user.role as Role,
      subscriptionId: subscription.id,
    });

    return {
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        role: user.role as Role,
        createdAt: user.createdAt.toISOString(),
      },
      activeSubscription: {
        id: subscription.id,
        userId: subscription.userId,
        formule: subscription.formule as unknown as SubscriptionPlan,
        dateDebut: dayjs(subscription.dateDebut).format('YYYY-MM-DD'),
        dateFin: dayjs(subscription.dateFin).format('YYYY-MM-DD'),
        bonus: subscription.bonus,
        statut: subscription.statut as unknown as SubscriptionStatus,
        createdAt: subscription.createdAt.toISOString(),
      },
    };
  }

  /**
   * Connexion classique : nom + mot de passe.
   * SPEC 5.3 & 7.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await userRepository.findByNom(dto.nom);

    if (!user) {
      throw new UnauthorizedError('Identifiants invalides');
    }

    if (!user.motDePasseHash) {
      throw new BadRequestError(
        'Votre compte n\'a pas encore été activé. Veuillez utiliser votre code d\'activation pour votre première connexion.'
      );
    }

    const passwordMatch = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Identifiants invalides');
    }

    // Pour les clients : vérification de l'abonnement actif et de la date de début
    let activeSub = null;
    if (user.role === 'client') {
      const subscription = await subscriptionRepository.findActiveByUserId(user.id);
      if (!subscription) {
        throw new ForbiddenError(
          'Votre abonnement est expiré ou inactif. Veuillez contacter l\'administratrice.'
        );
      }

      // Le service réel ne démarre qu'à la date de début (SPEC 5.1 & 7)
      const now = nowKinshasa();
      const startDate = dayjs(subscription.dateDebut);
      if (now.isBefore(startDate, 'day')) {
        throw new ForbiddenError(
          `Votre abonnement n'est pas encore actif (il débute le ${startDate.format('DD/MM/YYYY')})`
        );
      }

      activeSub = {
        id: subscription.id,
        userId: subscription.userId,
        formule: subscription.formule as unknown as SubscriptionPlan,
        dateDebut: dayjs(subscription.dateDebut).format('YYYY-MM-DD'),
        dateFin: dayjs(subscription.dateFin).format('YYYY-MM-DD'),
        bonus: subscription.bonus,
        statut: subscription.statut as unknown as SubscriptionStatus,
        createdAt: subscription.createdAt.toISOString(),
      };
    }

    const token = this.generateToken({
      userId: user.id,
      nom: user.nom,
      role: user.role as Role,
      subscriptionId: activeSub?.id,
    });

    return {
      token,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        role: user.role as Role,
        createdAt: user.createdAt.toISOString(),
      },
      activeSubscription: activeSub,
    };
  }

  /**
   * Changement de mot de passe par le client connecté.
   * SPEC 5.3.
   */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user || !user.motDePasseHash) {
      throw new NotFoundError('Utilisateur introuvable');
    }

    const match = await bcrypt.compare(dto.ancienMotDePasse, user.motDePasseHash);
    if (!match) {
      throw new BadRequestError('L\'ancien mot de passe est incorrect');
    }

    const newHash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);
    await userRepository.updatePassword(user.id, newHash);
  }
}

export const authService = new AuthService();
