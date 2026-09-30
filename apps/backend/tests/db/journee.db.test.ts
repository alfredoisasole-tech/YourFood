/**
 * Scénarios de bout en bout sur une vraie base PostgreSQL (SPEC 5.3 à 5.11).
 * Lancés seulement si TEST_DATABASE_URL est définie (voir tests/setup.ts).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/utils/prisma';
import {
  ADMIN_PASSWORD,
  CLIENT_PASSWORD,
  TUESDAY,
  api,
  createAdmin,
  createCatalog,
  createClient,
  hasTestDatabase,
  login,
  resetDatabase,
  tuesdayAt,
} from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.skipIf(!hasTestDatabase)('Journée type avec base de données', () => {
  let adminToken: string;
  let catalog: Awaited<ReturnType<typeof createCatalog>>;
  let offerId: number;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(tuesdayAt('10:00'));
    await resetDatabase();
    await createAdmin();
    catalog = await createCatalog();

    // Trois clients en cours d'abonnement (du lundi 5 au vendredi 30 octobre) et un expiré
    await createClient({ prenom: 'Patrick', nom: 'Mbuyi', formule: 'F_25000', dateDebut: '2026-10-05', dateFin: '2026-10-30' });
    await createClient({ prenom: 'Mireille', nom: 'Kabongo', formule: 'F_35000', dateDebut: '2026-10-05', dateFin: '2026-10-30' });
    await createClient({ prenom: 'Sarah', nom: 'Ilunga', formule: 'F_35000', dateDebut: '2026-10-05', dateFin: '2026-10-30' });
    await createClient({ prenom: 'Freddy', nom: 'Kalala', formule: 'F_35000', dateDebut: '2026-09-14', dateFin: '2026-09-25' });

    adminToken = await login('Sarah BOKETSU', ADMIN_PASSWORD);
    const published = await api
      .post('/api/admin/offers/single')
      .set(auth(adminToken))
      .send({
        date: TUESDAY,
        catalogItemIds: [...catalog.plats, ...catalog.accompagnements, ...catalog.viandes],
      });
    expect(published.status).toBe(201);
    offerId = published.body.id as number;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function optionsOf(token: string) {
    const menu = await api.get('/api/offers/today').set(auth(token));
    expect(menu.status).toBe(200);
    return menu.body;
  }

  it('commande avant 20h, annulation sans commande, puis attribution par défaut à 20h', async () => {
    const patrick = await login('Patrick Mbuyi', CLIENT_PASSWORD); // formule 25 000 : pas de viande le mardi
    const mireille = await login('Mireille Kabongo', CLIENT_PASSWORD);
    const sarah = await login('Sarah Ilunga', CLIENT_PASSWORD);

    const menu = await optionsOf(mireille);
    expect(menu.statutMenu).toBe('normal');
    expect(menu.estViandeAutoriseeAujourdhui).toBe(true);
    const [plat1, plat2] = menu.optionsParCategorie.plats.map((o: { optionId: number }) => o.optionId);
    const [acc1, acc2] = menu.optionsParCategorie.accompagnements.map((o: { optionId: number }) => o.optionId);
    const [viande1, viande2] = menu.optionsParCategorie.viandes.map((o: { optionId: number }) => o.optionId);

    // Mireille commande avec viande
    const order = await api
      .post('/api/orders')
      .set(auth(mireille))
      .send({ dailyOfferId: offerId, platOptionId: plat2, accompagnementOptionId: acc2, viandeOptionId: viande2 });
    expect(order.status).toBe(200);

    // Patrick (25 000) ne peut pas prendre de viande un mardi
    const refused = await api
      .post('/api/orders')
      .set(auth(patrick))
      .send({ dailyOfferId: offerId, platOptionId: plat1, accompagnementOptionId: acc1, viandeOptionId: viande1 });
    expect(refused.status).toBe(400);

    // Sarah annule sans avoir rien choisi : elle ne doit pas être livrée
    const cancel = await api.post(`/api/orders/${offerId}/cancel`).set(auth(sarah));
    expect(cancel.status).toBe(200);

    // Après l'heure indicative : en retard, mais toujours modifiable
    vi.setSystemTime(tuesdayAt('14:00'));
    expect((await optionsOf(mireille)).statutMenu).toBe('en_retard');

    // 20h05 : le suivi admin déclenche le verrouillage automatique
    vi.setSystemTime(tuesdayAt('20:05'));
    const live = await api.get('/api/admin/orders/live').set(auth(adminToken));
    expect(live.status).toBe(200);
    expect(live.body.statutOffre).toBe('verrouille');
    expect(live.body.clientsAnnules).toBe(1);
    expect(live.body.totalClientsActifs).toBe(3); // le client expiré n'est pas compté
    expect(live.body.totalLivraisonsPrevues).toBe(2);

    const rows = live.body.commandesDetaillees as { clientPrenom: string; origine: string; platNom: string; viandeNom: string | null }[];
    expect(rows).toHaveLength(2);
    const mireilleRow = rows.find((r) => r.clientPrenom === 'Mireille');
    const patrickRow = rows.find((r) => r.clientPrenom === 'Patrick');
    expect(mireilleRow?.origine).toBe('choisi');
    // Patrick n'a rien fait : il reçoit l'option la plus choisie (celle de Mireille), sans viande
    expect(patrickRow).toMatchObject({ origine: 'automatique', platNom: 'Spaghetti sauce tomate', viandeNom: null });

    // Après 20h : plus aucune modification
    const late = await api.post(`/api/orders/${offerId}/cancel`).set(auth(patrick));
    expect(late.status).toBe(403);
  });

  it('un client qui a annulé peut reprendre son repas avant 20h', async () => {
    const sarah = await login('Sarah Ilunga', CLIENT_PASSWORD);
    const menu = await optionsOf(sarah);
    await api.post(`/api/orders/${offerId}/cancel`).set(auth(sarah)).expect(200);

    const resumed = await api.post('/api/orders').set(auth(sarah)).send({
      dailyOfferId: offerId,
      platOptionId: menu.optionsParCategorie.plats[0].optionId,
      accompagnementOptionId: menu.optionsParCategorie.accompagnements[0].optionId,
      viandeOptionId: menu.optionsParCategorie.viandes[0].optionId,
    });
    expect(resumed.status).toBe(200);
    expect((await optionsOf(sarah)).commandeExistante.statut).toBe('en_attente');
  });

  it('un client expiré se connecte et voit une interface grisée, sans pouvoir commander', async () => {
    const freddy = await login('Freddy Kalala', CLIENT_PASSWORD);
    const menu = await optionsOf(freddy);
    expect(menu.etatAbonnement).toBe('expire');

    const cancel = await api.post(`/api/orders/${offerId}/cancel`).set(auth(freddy));
    expect(cancel.status).toBe(403);
  });

  it('un changement de mot de passe ferme les autres sessions', async () => {
    const oldSession = await login('Mireille Kabongo', CLIENT_PASSWORD);
    const otherSession = await login('Mireille Kabongo', CLIENT_PASSWORD);

    const changed = await api
      .put('/api/auth/change-password')
      .set(auth(oldSession))
      .send({ ancienMotDePasse: CLIENT_PASSWORD, nouveauMotDePasse: 'NouveauPass2026' });
    expect(changed.status).toBe(200);

    expect((await api.get('/api/auth/me').set(auth(otherSession))).status).toBe(401);
    expect((await api.get('/api/auth/me').set(auth(changed.body.token))).status).toBe(200);
  });

  it('inscription, lien avec le code et le nom, puis première connexion en deux étapes', async () => {
    const created = await api
      .post('/api/admin/clients')
      .set(auth(adminToken))
      .send({ nom: 'Ngoy', prenom: 'Ruth', formule: '35000', duree: { unite: 'mois', valeur: 1 } });
    expect(created.status).toBe(201);
    // Par défaut : le prochain lundi, 4 semaines, fin un vendredi
    expect(created.body.subscription).toMatchObject({ dateDebut: '2026-10-12', dateFin: '2026-11-06', totalFc: 140000 });
    expect(created.body.acces.whatsappUrl).toBeNull();
    expect(created.body.acces.lien).toContain(`#code=${created.body.acces.code}&nom=Ruth+Ngoy`);

    const code = created.body.acces.codeAffichage as string;
    expect((await api.post('/api/auth/verify-code').send({ identifiant: 'Ruth Ngoy', code })).status).toBe(200);
    const first = await api
      .post('/api/auth/first-login')
      .send({ identifiant: 'ruth ngoy', code, nouveauMotDePasse: 'MonMotDePasse1' });
    expect(first.status).toBe(200);
    expect(first.body.subscription.etat).toBe('non_commence');
  });

  it('modifier un client change son identifiant de connexion', async () => {
    const list = await api.get('/api/admin/clients?q=mireille').set(auth(adminToken));
    const mireille = list.body.clients[0];

    const updated = await api
      .patch(`/api/admin/clients/${mireille.id}`)
      .set(auth(adminToken))
      .send({ nom: 'Kabongo-Mulumba', telephone: '+243 81 234 5678', bonus: 'Dessert offert' });
    expect(updated.status).toBe(200);
    expect(updated.body.telephone).toBe('+243812345678');

    await login('Mireille Kabongo-Mulumba', CLIENT_PASSWORD);
    const detail = await api.get(`/api/admin/clients/${mireille.id}`).set(auth(adminToken));
    expect(detail.body.abonnementCourant.bonus).toBe('Dessert offert');

    const homonyme = await api
      .patch(`/api/admin/clients/${mireille.id}`)
      .set(auth(adminToken))
      .send({ prenom: 'Sarah', nom: 'Ilunga' });
    expect(homonyme.status).toBe(409);
  });

  it('désactiver un plat le retire des menus à venir, sauf s\'il a déjà été choisi', async () => {
    const tomorrow = await api
      .post('/api/admin/offers/single')
      .set(auth(adminToken))
      .send({ date: '2026-10-07', catalogItemIds: [...catalog.plats, ...catalog.accompagnements, ...catalog.viandes] });
    expect(tomorrow.status).toBe(201);

    const res = await api
      .put(`/api/admin/catalog/${catalog.plats[0]}`)
      .set(auth(adminToken))
      .send({ actif: false });
    expect(res.status).toBe(200);
    // Retiré du menu de demain ; le menu du jour, déjà affiché aux clients, n'est pas touché
    expect(res.body.menusRetires).toEqual(['2026-10-07']);
    expect(res.body.item.prochainsMenus).toEqual([TUESDAY]);

    const week = await api.get('/api/admin/offers?from=2026-10-06&to=2026-10-07').set(auth(adminToken));
    const wednesday = week.body.find((d: { date: string }) => d.date === '2026-10-07');
    expect(wednesday.offre.plats.map((p: { nom: string }) => p.nom)).toEqual(['Spaghetti sauce tomate']);
  });

  it('statistiques : clients actifs, livraisons et plat le plus commandé', async () => {
    const mireille = await login('Mireille Kabongo', CLIENT_PASSWORD);
    const menu = await optionsOf(mireille);
    await api.post('/api/orders').set(auth(mireille)).send({
      dailyOfferId: offerId,
      platOptionId: menu.optionsParCategorie.plats[1].optionId,
      accompagnementOptionId: menu.optionsParCategorie.accompagnements[0].optionId,
      viandeOptionId: menu.optionsParCategorie.viandes[0].optionId,
    });

    const stats = await api.get('/api/admin/stats/overview').set(auth(adminToken));
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ clientsActifs: 3, clientsTotal: 4, livraisons: 3 });
    expect(stats.body.platsPlusCommandes.semaine).toEqual({ nom: 'Spaghetti sauce tomate', quantite: 1 });
  });

  it('le renouvellement commence le lundi qui suit la fin de la période en cours', async () => {
    const list = await api.get('/api/admin/clients?q=patrick').set(auth(adminToken));
    const renew = await api
      .post(`/api/admin/clients/${list.body.clients[0].subscriptionId}/renew`)
      .set(auth(adminToken))
      .send({ duree: { unite: 'semaines', valeur: 2 } });
    expect(renew.status).toBe(200);
    expect(renew.body).toMatchObject({ dateDebut: '2026-11-02', dateFin: '2026-11-13', totalFc: 50000 });

    const periods = await prisma.subscription.count({ where: { user: { prenom: 'Patrick' } } });
    expect(periods).toBe(2);
  });
});
