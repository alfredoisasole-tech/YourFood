import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  dailyOffer: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  order: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  subscription: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../src/utils/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

import { orderService } from '../../src/services/order.service';
import { ClientSubscriptionContext } from '../../src/services/subscription.service';

// Mardi 29 septembre 2026, heure de Kinshasa (UTC+1)
const TUESDAY_9H = new Date('2026-09-29T09:00:00+01:00');
const TUESDAY_20H05 = new Date('2026-09-29T20:05:00+01:00');
const OFFER_DATE = new Date('2026-09-29T00:00:00.000Z');

const item = (categorie: string) => ({ catalogItem: { categorie, nom: categorie } });
const menuOptions = [
  { id: 1, ...item('plat') },
  { id: 2, ...item('plat') },
  { id: 3, ...item('accompagnement') },
  { id: 4, ...item('accompagnement') },
  { id: 5, ...item('viande') },
  { id: 6, ...item('viande') },
];
const openOffer = { id: 100, date: OFFER_DATE, statut: 'ouvert', options: menuOptions };

const sub = (id: number, formule: 'F_25000' | 'F_35000') => ({ id, formule, userId: id });

const clientContext = (
  formule: '25000' | '35000',
  etat: 'actif' | 'expire' | 'non_commence' = 'actif'
): ClientSubscriptionContext =>
  ({
    subscription: { id: 5, userId: 1 },
    view: { etat, formule, dateDebut: '2026-09-07', dateFin: '2026-10-30' },
  }) as unknown as ClientSubscriptionContext;

describe('OrderService (SPEC 5.6, 5.7, 5.8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TUESDAY_9H);
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock)
    );
    prismaMock.dailyOffer.findUnique.mockResolvedValue(openOffer);
    prismaMock.dailyOffer.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.createMany.mockResolvedValue({ count: 0 });
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.upsert.mockResolvedValue({ id: 900 });
    prismaMock.subscription.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lockAndAssignDefaults', () => {
    it('attribue une commande par défaut aux seuls clients sans choix ni annulation', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        // Client 10 : a annulé, ne doit rien recevoir
        { subscriptionId: 10, statut: 'annulee', platId: null, accompagnementId: null, viandeId: null },
        // Client 11 : a commandé, ne doit rien recevoir
        { subscriptionId: 11, statut: 'en_attente', platId: 2, accompagnementId: 4, viandeId: 6 },
      ]);
      prismaMock.subscription.findMany.mockResolvedValue([
        sub(10, 'F_25000'),
        sub(11, 'F_35000'),
        sub(12, 'F_25000'),
        sub(13, 'F_35000'),
      ]);

      await orderService.lockAndAssignDefaults(100);

      const { data } = prismaMock.order.createMany.mock.calls[0]?.[0] as {
        data: { subscriptionId: number }[];
      };
      expect(data.map((o) => o.subscriptionId)).toEqual([12, 13]);
    });

    it('donne l\'option la plus demandée, et pas de viande à une formule 25 000 un mardi', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { subscriptionId: 11, statut: 'en_attente', platId: 2, accompagnementId: 4, viandeId: 6 },
        { subscriptionId: 14, statut: 'en_attente', platId: 2, accompagnementId: 3, viandeId: 6 },
      ]);
      prismaMock.subscription.findMany.mockResolvedValue([
        sub(11, 'F_35000'),
        sub(14, 'F_35000'),
        sub(12, 'F_25000'),
        sub(13, 'F_35000'),
      ]);

      await orderService.lockAndAssignDefaults(100);

      const { data } = prismaMock.order.createMany.mock.calls[0]?.[0] as {
        data: Record<string, unknown>[];
      };
      const formule25 = data.find((o) => o.subscriptionId === 12);
      const formule35 = data.find((o) => o.subscriptionId === 13);

      expect(formule25).toMatchObject({ platId: 2, accompagnementId: 3, viandeId: null, estDefaut: true });
      expect(formule35).toMatchObject({ platId: 2, accompagnementId: 3, viandeId: 6, estDefaut: true });
    });

    it('ne considère que les abonnements qui couvrent le jour du menu', async () => {
      await orderService.lockAndAssignDefaults(100);

      expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
        where: { dateDebut: { lte: OFFER_DATE }, dateFin: { gte: OFFER_DATE } },
      });
    });

    it('est sans effet si un autre appel a déjà verrouillé le menu', async () => {
      prismaMock.dailyOffer.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.subscription.findMany.mockResolvedValue([sub(12, 'F_25000')]);

      await orderService.lockAndAssignDefaults(100);

      expect(prismaMock.order.createMany).not.toHaveBeenCalled();
    });

    it('ne fait rien pour un menu déjà verrouillé', async () => {
      prismaMock.dailyOffer.findUnique.mockResolvedValue({ ...openOffer, statut: 'verrouille' });

      await orderService.lockAndAssignDefaults(100);

      expect(prismaMock.dailyOffer.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('ensureLocked', () => {
    it('ne verrouille pas avant 20h', async () => {
      await orderService.ensureLocked('2026-09-29');
      expect(prismaMock.dailyOffer.updateMany).not.toHaveBeenCalled();
    });

    it('verrouille à 20h05 sans action manuelle', async () => {
      vi.setSystemTime(TUESDAY_20H05);
      await orderService.ensureLocked('2026-09-29');
      expect(prismaMock.dailyOffer.updateMany).toHaveBeenCalled();
    });
  });

  describe('cancelOrder (SPEC 5.7)', () => {
    it('enregistre l\'annulation même sans commande préalable, pour éviter le repas par défaut', async () => {
      await orderService.cancelOrder(clientContext('35000'), 100);

      expect(prismaMock.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { dailyOfferId: 100, subscriptionId: 5, statut: 'annulee' },
        })
      );
    });

    it('refuse l\'annulation après 20h', async () => {
      vi.setSystemTime(TUESDAY_20H05);
      await expect(orderService.cancelOrder(clientContext('35000'), 100)).rejects.toThrow(/verrouillé/);
    });

    it('refuse l\'annulation pour un abonnement expiré', async () => {
      await expect(orderService.cancelOrder(clientContext('35000', 'expire'), 100)).rejects.toThrow(/terminé/);
    });
  });

  describe('submitOrder (SPEC 5.6)', () => {
    it('refuse une viande à un client formule 25 000 un mardi', async () => {
      await expect(
        orderService.submitOrder(clientContext('25000'), {
          dailyOfferId: 100,
          platOptionId: 1,
          accompagnementOptionId: 3,
          viandeOptionId: 5,
        })
      ).rejects.toThrow(/n'inclut pas la viande/);
    });

    it('enregistre sans viande pour la formule 25 000 un mardi', async () => {
      await orderService.submitOrder(clientContext('25000'), {
        dailyOfferId: 100,
        platOptionId: 1,
        accompagnementOptionId: 3,
      });

      expect(prismaMock.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ viandeId: null, statut: 'en_attente', estDefaut: false }),
        })
      );
    });

    it('exige la viande d\'un client formule 35 000 quand le menu en propose', async () => {
      await expect(
        orderService.submitOrder(clientContext('35000'), {
          dailyOfferId: 100,
          platOptionId: 1,
          accompagnementOptionId: 3,
        })
      ).rejects.toThrow(/Choisis ta viande/);
    });

    it('refuse une option qui n\'est pas de la bonne catégorie', async () => {
      await expect(
        orderService.submitOrder(clientContext('35000'), {
          dailyOfferId: 100,
          platOptionId: 3, // un accompagnement à la place d'un plat
          accompagnementOptionId: 4,
          viandeOptionId: 5,
        })
      ).rejects.toThrow(/ne fait pas partie du menu/);
    });

    it('permet de reprendre son repas après une annulation (la commande redevient en attente)', async () => {
      await orderService.submitOrder(clientContext('35000'), {
        dailyOfferId: 100,
        platOptionId: 1,
        accompagnementOptionId: 3,
        viandeOptionId: 5,
      });

      expect(prismaMock.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ statut: 'en_attente' }) })
      );
    });

    it('refuse une commande pour un autre jour que le jour même', async () => {
      prismaMock.dailyOffer.findUnique.mockResolvedValue({
        ...openOffer,
        date: new Date('2026-09-30T00:00:00.000Z'),
      });
      await expect(
        orderService.submitOrder(clientContext('35000'), {
          dailyOfferId: 100,
          platOptionId: 1,
          accompagnementOptionId: 3,
          viandeOptionId: 5,
        })
      ).rejects.toThrow(/repas du jour/);
    });
  });
});
