/**
 * Service Métier : Gestion des Clients et Abonnements (côté Admin).
 * Conforme à SPEC.md (5.1, 5.2, 5.3, 5.11 & 6) et AG_RULES.md.
 */

import { Prisma, AccessCodeType as PrismaAccessCodeType } from '@prisma/client';
import {
  CreateClientDto,
  CreateClientResponse,
  UpdateClientDto,
  User,
  RenewSubscriptionDto,
  ClientDetailView,
  ClientListFilter,
  ClientListRow,
  ClientListView,
  AccessDelivery,
  SubscriptionView,
  OrderStatus,
  computeSubscriptionEnd,
  durationToWeeks,
  getSubscriptionState,
  nextMonday,
  pickCurrentPeriod,
} from '@meal-app/shared';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { userRepository } from '../repositories/user.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { generateActivationCode } from '../utils/codeGenerator';
import { buildLoginKey, normalizeName } from '../utils/loginKey';
import { fromDbDate, getTodayDateString, toDbDate } from '../utils/time';
import { buildAccessDelivery, buildResetMessage, buildWelcomeMessage } from '../utils/whatsapp';
import { toPrismaFormule, toSharedFormule, toSubscriptionView, toUser } from '../utils/mappers';
import { mealLabel } from '../utils/orderFormat';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';

type Tx = Prisma.TransactionClient;

export class ClientService {
  private getFrontendUrl(): string {
    return config.frontendUrl;
  }

  /** Génère un code d'accès unique (2 initiales + 6 caractères aléatoires) */
  private async generateUniqueCode(tx: Tx, nom: string, prenom: string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateActivationCode(nom, prenom);
      const existing = await tx.accessCode.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    }
    throw new Error("Impossible de générer un code d'accès unique");
  }

  /**
   * Inscription d'un nouveau client (100% côté admin).
   * SPEC 5.1 & 5.2. L'abonnement commence un lundi (le prochain par défaut) et finit un vendredi.
   */
  async createClient(dto: CreateClientDto): Promise<CreateClientResponse> {
    const today = getTodayDateString();

    const loginKey = buildLoginKey(dto.prenom, dto.nom);
    if (await userRepository.findByLoginKey(loginKey)) {
      throw new ConflictError(
        `Un client s'appelle déjà « ${dto.prenom.trim()} ${dto.nom.trim()} ». ` +
          'Ajoute un détail qui les distingue (par exemple une initiale) dans le nom ou le prénom.'
      );
    }

    if (dto.telephone && (await userRepository.findByTelephone(dto.telephone))) {
      throw new ConflictError('Un client existe déjà avec ce numéro de téléphone');
    }

    const dateDebut = dto.dateDebut ?? nextMonday(today);
    if (dateDebut < today) {
      throw new BadRequestError('La date de début ne peut pas être dans le passé');
    }
    const dateFin = computeSubscriptionEnd(dateDebut, durationToWeeks(dto.duree));

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nom: dto.nom.trim(),
          prenom: dto.prenom.trim(),
          telephone: dto.telephone ?? null,
          loginKey,
          role: 'client',
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          formule: toPrismaFormule(dto.formule),
          dateDebut: toDbDate(dateDebut),
          dateFin: toDbDate(dateFin),
          bonus: dto.bonus?.trim() || null,
          statut: 'actif',
        },
      });

      const code = await this.generateUniqueCode(tx, user.nom, user.prenom);
      await tx.accessCode.create({
        data: {
          subscriptionId: subscription.id,
          code,
          type: PrismaAccessCodeType.activation,
          utilise: false,
        },
      });

      return { user, subscription, code };
    });

    const acces = this.buildWelcomeDelivery(result.user, result.code, dateDebut);

    return {
      client: toUser(result.user),
      subscription: toSubscriptionView(result.subscription, today),
      acces,
    };
  }

  private buildWelcomeDelivery(
    user: { prenom: string; nom: string; telephone: string | null },
    code: string,
    dateDebut: string
  ): AccessDelivery {
    return buildAccessDelivery({
      telephone: user.telephone,
      code,
      identifiant: `${user.prenom} ${user.nom}`,
      frontendUrl: this.getFrontendUrl(),
      message: (lien) => buildWelcomeMessage({ prenom: user.prenom, dateDebut, lien, code }),
    });
  }

  /**
   * Modification des informations d'un client (correction d'une faute de frappe, nouveau numéro…).
   * - Nom et prénom forment l'identifiant de connexion : il est recalculé et doit rester unique ;
   *   le client se connecte ensuite avec le nouveau nom.
   * - Le bonus modifié est celui de la période d'abonnement courante.
   */
  async updateClient(userId: number, dto: UpdateClientDto): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'client') {
      throw new NotFoundError('Client introuvable');
    }

    const nom = dto.nom?.trim() ?? user.nom;
    const prenom = dto.prenom?.trim() ?? user.prenom;
    const loginKey = buildLoginKey(prenom, nom);
    if (loginKey !== user.loginKey) {
      const homonyme = await userRepository.findByLoginKey(loginKey);
      if (homonyme && homonyme.id !== userId) {
        throw new ConflictError(
          `Un client s'appelle déjà « ${prenom} ${nom} ». Ajoute un détail qui les distingue.`
        );
      }
    }

    if (dto.telephone) {
      const sameNumber = await userRepository.findByTelephone(dto.telephone);
      if (sameNumber && sameNumber.id !== userId) {
        throw new ConflictError('Un autre client utilise déjà ce numéro de téléphone');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (dto.bonus !== undefined) {
        const current = await subscriptionRepository.findCurrentByUserId(userId, getTodayDateString());
        if (current) {
          await tx.subscription.update({ where: { id: current.id }, data: { bonus: dto.bonus } });
        }
      }
      return tx.user.update({
        where: { id: userId },
        data: {
          nom,
          prenom,
          loginKey,
          ...(dto.telephone !== undefined ? { telephone: dto.telephone } : {}),
        },
      });
    });

    return toUser(updated);
  }

  /**
   * « Renvoyer le message de bienvenue » (SPEC 6) : ré-affiche le même code tant qu'il n'a pas servi.
   * Une fois le compte activé, il faut passer par la réinitialisation du mot de passe.
   */
  async resendWelcome(userId: number): Promise<AccessDelivery> {
    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'client') {
      throw new NotFoundError('Client introuvable');
    }

    const pending = await prisma.accessCode.findFirst({
      where: {
        utilise: false,
        type: PrismaAccessCodeType.activation,
        subscription: { userId },
      },
      orderBy: { dateGeneration: 'desc' },
      include: { subscription: true },
    });

    if (!pending) {
      throw new ConflictError(
        'Ce client a déjà activé son compte. Utilise « Réinitialiser le mot de passe » pour lui donner un nouvel accès.'
      );
    }

    const today = getTodayDateString();
    const current = await subscriptionRepository.findCurrentByUserId(userId, today);
    const dateDebut = fromDbDate((current ?? pending.subscription).dateDebut);
    return this.buildWelcomeDelivery(user, pending.code, dateDebut);
  }

  /**
   * Réinitialisation de mot de passe oublié initiée par l'admin depuis la fiche client.
   * SPEC 5.3 : nouveau code à usage unique, même mécanisme que l'activation.
   */
  async resetPassword(subscriptionId: number): Promise<AccessDelivery> {
    const subscription = await subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Abonnement introuvable');
    }

    const user = await userRepository.findById(subscription.userId);
    if (!user) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    if (!user.motDePasseHash) {
      throw new ConflictError(
        "Ce client n'a pas encore activé son compte : renvoie-lui son message de bienvenue."
      );
    }

    const code = await prisma.$transaction(async (tx) => {
      // Un seul code de réinitialisation valable à la fois
      await tx.accessCode.updateMany({
        where: {
          utilise: false,
          type: PrismaAccessCodeType.reinitialisation,
          subscription: { userId: user.id },
        },
        data: { utilise: true, dateUtilisation: new Date() },
      });

      const newCode = await this.generateUniqueCode(tx, user.nom, user.prenom);
      await tx.accessCode.create({
        data: {
          subscriptionId: subscription.id,
          code: newCode,
          type: PrismaAccessCodeType.reinitialisation,
        },
      });
      return newCode;
    });

    return buildAccessDelivery({
      telephone: user.telephone,
      code,
      identifiant: `${user.prenom} ${user.nom}`,
      frontendUrl: this.getFrontendUrl(),
      message: (lien) => buildResetMessage({ prenom: user.prenom, lien, code }),
    });
  }

  /**
   * Renouvellement ou prolongation d'abonnement par l'admin (SPEC 5.11).
   * - L'ancienne période est conservée en historique et reste valable jusqu'à sa fin ;
   * - la nouvelle commence un lundi : par défaut le lundi qui suit la fin de la dernière période
   *   (ou le prochain lundi si tout est déjà expiré), au choix de l'admin sinon ;
   * - aucun nouveau code ni lien : le client se reconnecte normalement.
   */
  async renewSubscription(
    subscriptionId: number,
    dto: RenewSubscriptionDto
  ): Promise<SubscriptionView> {
    const currentSub = await subscriptionRepository.findById(subscriptionId);
    if (!currentSub) {
      throw new NotFoundError('Abonnement à renouveler introuvable');
    }

    const today = getTodayDateString();
    const history = await subscriptionRepository.findHistoryByUserId(currentSub.userId);
    const lastEnd = history
      .map((sub) => fromDbDate(sub.dateFin))
      .reduce((latest, end) => (end > latest ? end : latest), '0000-00-00');

    const dateDebut = dto.dateDebut ?? nextMonday(lastEnd > today ? lastEnd : today);
    if (dateDebut < today) {
      throw new BadRequestError('La date de début ne peut pas être dans le passé');
    }
    if (dateDebut <= lastEnd) {
      throw new BadRequestError(
        "La nouvelle période chevaucherait l'abonnement en cours : choisis un lundi après sa fin."
      );
    }
    const dateFin = computeSubscriptionEnd(dateDebut, durationToWeeks(dto.duree));

    const created = await prisma.$transaction(async (tx) => {
      // Les périodes déjà terminées sont marquées expirées (l'état affiché reste calculé sur les dates)
      await tx.subscription.updateMany({
        where: { userId: currentSub.userId, dateFin: { lt: toDbDate(today) }, statut: 'actif' },
        data: { statut: 'expire' },
      });

      return tx.subscription.create({
        data: {
          userId: currentSub.userId,
          formule: dto.formule ? toPrismaFormule(dto.formule) : currentSub.formule,
          dateDebut: toDbDate(dateDebut),
          dateFin: toDbDate(dateFin),
          bonus: currentSub.bonus,
          statut: 'actif',
        },
      });
    });

    return toSubscriptionView(created, today);
  }

  /**
   * Liste des clients avec état coloré, jours restants et compteurs par filtre (SPEC 6).
   * « Actif » regroupe les abonnements en cours et ceux qui n'ont pas encore commencé.
   */
  async listClients(filters: { q?: string; etat?: ClientListFilter }): Promise<ClientListView> {
    const today = getTodayDateString();
    const users = await prisma.user.findMany({
      where: { role: 'client' },
      include: { subscriptions: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    const rows: ClientListRow[] = users.map((user) => {
      const periods = user.subscriptions.map((sub) => ({
        sub,
        dateDebut: fromDbDate(sub.dateDebut),
        dateFin: fromDbDate(sub.dateFin),
      }));
      const current = pickCurrentPeriod(periods, today);
      const state = current ? getSubscriptionState(current, today) : null;

      return {
        id: user.id,
        subscriptionId: current?.sub.id ?? null,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        formule: current ? toSharedFormule(current.sub.formule) : null,
        etat: state?.etat ?? null,
        joursRestants: state?.joursRestants ?? 0,
        dateFin: current?.dateFin ?? null,
      };
    });

    const groupOf = (row: ClientListRow): ClientListFilter | null => {
      if (row.etat === 'expire') return 'expire';
      if (row.etat === 'bientot_expire') return 'bientot_expire';
      if (row.etat === 'actif' || row.etat === 'non_commence') return 'actif';
      return null;
    };

    const compteurs = {
      tous: rows.length,
      actifs: rows.filter((r) => groupOf(r) === 'actif').length,
      bientotExpires: rows.filter((r) => groupOf(r) === 'bientot_expire').length,
      expires: rows.filter((r) => groupOf(r) === 'expire').length,
    };

    const query = filters.q ? normalizeName(filters.q) : '';
    const clients = rows.filter((row) => {
      if (filters.etat && groupOf(row) !== filters.etat) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = normalizeName(`${row.prenom} ${row.nom} ${row.telephone ?? ''}`);
      return haystack.includes(query);
    });

    return { clients, compteurs };
  }

  /**
   * Vue détaillée d'un client avec ses 3 onglets (Infos, Historique, Avis).
   * SPEC 6.
   */
  async getClientDetail(userId: number): Promise<ClientDetailView> {
    const user = await userRepository.findById(userId);
    if (!user || user.role !== 'client') {
      throw new NotFoundError('Client introuvable');
    }

    const today = getTodayDateString();
    const subscriptions = await subscriptionRepository.findHistoryByUserId(userId);
    const views = subscriptions.map((sub) => toSubscriptionView(sub, today));
    const current = pickCurrentPeriod(views, today);

    const orders = await prisma.order.findMany({
      where: { subscription: { userId } },
      include: {
        dailyOffer: true,
        plat: { include: { catalogItem: true } },
        accompagnement: { include: { catalogItem: true } },
        viande: { include: { catalogItem: true } },
        review: true,
      },
      orderBy: { dailyOffer: { date: 'desc' } },
    });

    const avis = orders
      .filter((o) => o.review?.rempli)
      .map((o) => ({
        orderId: o.id,
        date: fromDbDate(o.dailyOffer.date),
        repas: mealLabel(o),
        noteEtoile: o.review?.noteEtoile ?? null,
        commentaire: o.review?.commentaire ?? null,
      }));

    const notes = avis.map((r) => r.noteEtoile).filter((n): n is number => n !== null);
    const noteMoyenne =
      notes.length > 0 ? Number((notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1)) : null;

    return {
      client: toUser(user),
      abonnementCourant: current,
      historiqueAbonnements: views,
      historiqueJours: orders.map((o) => ({
        orderId: o.id,
        date: fromDbDate(o.dailyOffer.date),
        platNom: o.plat?.catalogItem.nom ?? null,
        accompagnementNom: o.accompagnement?.catalogItem.nom ?? null,
        viandeNom: o.viande?.catalogItem.nom ?? null,
        statut: o.statut as unknown as OrderStatus,
        estDefaut: o.estDefaut,
      })),
      avis,
      noteMoyenne,
    };
  }
}

export const clientService = new ClientService();
