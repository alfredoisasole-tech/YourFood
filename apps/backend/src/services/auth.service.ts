/**
 * Service Métier : Authentification & Sessions.
 * Conforme à SPEC.md (5.3 & 7) et AG_RULES.md.
 *
 * Chaque jeton porte la version du mot de passe de l'utilisateur (`tv`). Un changement de mot de
 * passe (volontaire ou après réinitialisation) incrémente cette version : les jetons émis avant
 * sont refusés par le middleware `authenticate`.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User as PrismaUser } from '@prisma/client';
import {
  FirstLoginDto,
  LoginDto,
  VerifyCodeDto,
  VerifyCodeResponse,
  ChangePasswordDto,
  AuthResponse,
  SessionResponse,
  AccessCodeType,
  Role,
} from '@meal-app/shared';
import { userRepository } from '../repositories/user.repository';
import { accessCodeRepository, AccessCodeWithOwner } from '../repositories/accessCode.repository';
import { subscriptionService } from './subscription.service';
import { prisma } from '../utils/prisma';
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors';
import { loginKeyCandidates } from '../utils/loginKey';
import { formatDateFr } from '../utils/whatsapp';
import { fromDbDate } from '../utils/time';
import { toUser } from '../utils/mappers';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

/** Message volontairement unique : on ne révèle pas si c'est le nom ou le code qui est faux */
const INVALID_CODE_MESSAGE = 'Ce code ne correspond pas à ce nom, ou il a déjà été utilisé.';

interface VerifiedCode {
  codeRecord: AccessCodeWithOwner;
  user: PrismaUser;
}

export class AuthService {
  private generateToken(user: PrismaUser): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET manquant dans la configuration');
    }
    return jwt.sign(
      { userId: user.id, nom: user.nom, role: user.role as unknown as Role, tv: user.tokenVersion },
      secret,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Retrouve le code et vérifie qu'il est valable ET qu'il appartient bien au nom saisi.
   * Le code seul ne suffit pas : c'est le couple nom + code qui ouvre l'accès (SPEC 5.3).
   */
  private async verifyCodeOwnership(dto: VerifyCodeDto): Promise<VerifiedCode> {
    const codeRecord = await accessCodeRepository.findByCode(dto.code);
    if (!codeRecord || codeRecord.utilise) {
      throw new BadRequestError(INVALID_CODE_MESSAGE);
    }

    const user = codeRecord.subscription.user;
    if (!loginKeyCandidates(dto.identifiant).includes(user.loginKey)) {
      throw new BadRequestError(INVALID_CODE_MESSAGE);
    }

    return { codeRecord, user };
  }

  /**
   * Étape 1 de la première connexion (« Code accepté, bienvenue ») : vérifie le couple nom + code
   * sans le consommer. Le code n'est consommé qu'à la création du mot de passe.
   */
  async verifyCode(dto: VerifyCodeDto): Promise<VerifyCodeResponse> {
    const { codeRecord, user } = await this.verifyCodeOwnership(dto);
    return { prenom: user.prenom, type: codeRecord.type as unknown as AccessCodeType };
  }

  /**
   * Étape 2 : création (ou nouveau choix, après réinitialisation) du mot de passe.
   * Le code est consommé dans la même transaction : impossible de l'utiliser deux fois.
   */
  async firstLogin(dto: FirstLoginDto): Promise<AuthResponse> {
    const { codeRecord, user } = await this.verifyCodeOwnership(dto);
    const hash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.accessCode.updateMany({
        where: { id: codeRecord.id, utilise: false },
        data: { utilise: true, dateUtilisation: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestError(INVALID_CODE_MESSAGE);
      }
      return tx.user.update({
        where: { id: user.id },
        data: { motDePasseHash: hash, tokenVersion: { increment: 1 } },
      });
    });

    return this.buildAuthResponse(updated);
  }

  /**
   * Connexion classique : identifiant (« Prénom Nom ») + mot de passe.
   * - Un abonnement expiré donne accès à une interface grisée (SPEC 5.11).
   * - Un abonnement pas encore commencé est refusé avec sa date de début (SPEC 7).
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await userRepository.findByIdentifiant(dto.identifiant);

    if (!user) {
      throw new UnauthorizedError('Identifiants invalides');
    }

    if (!user.motDePasseHash) {
      throw new BadRequestError(
        "Ton compte n'est pas encore activé. Utilise le code reçu pour ta première connexion."
      );
    }

    const passwordMatch = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Identifiants invalides');
    }

    if (user.role === 'client') {
      const context = await subscriptionService.getCurrent(user.id);
      if (!context) {
        throw new ForbiddenError("Aucun abonnement n'est associé à ce compte");
      }
      if (context.view.etat === 'non_commence') {
        throw new ForbiddenError(
          `Ton abonnement commence le ${formatDateFr(fromDbDate(context.subscription.dateDebut))}, on t'attend à table.`,
          { code: 'ABONNEMENT_NON_COMMENCE', dateDebut: context.view.dateDebut }
        );
      }
    }

    return this.buildAuthResponse(user);
  }

  /** Session courante : utilisateur + abonnement courant, recalculés à chaque appel */
  async getSession(userId: number): Promise<SessionResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    const context = user.role === 'client' ? await subscriptionService.getCurrent(user.id) : null;
    return { user: toUser(user), subscription: context?.view ?? null };
  }

  /**
   * Changement de mot de passe par l'utilisateur connecté (SPEC 5.3).
   * Les autres sessions sont fermées ; la session courante reçoit un nouveau jeton.
   */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<AuthResponse> {
    const user = await userRepository.findById(userId);
    if (!user?.motDePasseHash) {
      throw new NotFoundError('Utilisateur introuvable');
    }

    const match = await bcrypt.compare(dto.ancienMotDePasse, user.motDePasseHash);
    if (!match) {
      throw new BadRequestError("L'ancien mot de passe est incorrect");
    }

    const newHash = await bcrypt.hash(dto.nouveauMotDePasse, BCRYPT_ROUNDS);
    const updated = await userRepository.updatePassword(user.id, newHash);
    return this.buildAuthResponse(updated);
  }

  private async buildAuthResponse(user: PrismaUser): Promise<AuthResponse> {
    const context = user.role === 'client' ? await subscriptionService.getCurrent(user.id) : null;

    return {
      token: this.generateToken(user),
      user: toUser(user),
      subscription: context?.view ?? null,
    };
  }
}

export const authService = new AuthService();
