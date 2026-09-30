/**
 * Outils des tests d'intégration avec base de données réelle.
 */

import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { buildLoginKey } from '../../src/utils/loginKey';

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

export const api = request(app);

/** Mardi 6 octobre 2026 à l'heure indiquée, heure de Kinshasa (UTC+1) */
export function tuesdayAt(time: string): Date {
  return new Date(`2026-10-06T${time}:00+01:00`);
}

export const TUESDAY = '2026-10-06';

/** Vide toutes les tables (la base doit être dédiée aux tests) */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE reviews, orders, offer_options, daily_offers, access_codes, subscriptions, catalog_items, users RESTART IDENTITY CASCADE'
  );
}

export const ADMIN_PASSWORD = 'Admin@2026!';
export const CLIENT_PASSWORD = 'Client@2026!';

const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export async function createAdmin(): Promise<void> {
  await prisma.user.create({
    data: {
      nom: 'BOKETSU',
      prenom: 'Sarah',
      loginKey: buildLoginKey('Sarah', 'BOKETSU'),
      role: 'admin',
      motDePasseHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
    },
  });
}

/** Client déjà activé (mot de passe CLIENT_PASSWORD) avec une période d'abonnement */
export async function createClient(params: {
  prenom: string;
  nom: string;
  formule: 'F_25000' | 'F_35000';
  dateDebut: string;
  dateFin: string;
}): Promise<{ userId: number; subscriptionId: number }> {
  const user = await prisma.user.create({
    data: {
      nom: params.nom,
      prenom: params.prenom,
      loginKey: buildLoginKey(params.prenom, params.nom),
      role: 'client',
      motDePasseHash: await bcrypt.hash(CLIENT_PASSWORD, 4),
    },
  });
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      formule: params.formule,
      dateDebut: toDbDate(params.dateDebut),
      dateFin: toDbDate(params.dateFin),
    },
  });
  return { userId: user.id, subscriptionId: subscription.id };
}

/** Crée des plats et retourne leurs identifiants par catégorie */
export async function createCatalog(): Promise<{ plats: number[]; accompagnements: number[]; viandes: number[] }> {
  const create = async (nom: string, categorie: 'plat' | 'accompagnement' | 'viande') =>
    (await prisma.catalogItem.create({ data: { nom, categorie } })).id;

  return {
    plats: [await create('Riz cantonais', 'plat'), await create('Spaghetti sauce tomate', 'plat')],
    accompagnements: [
      await create('Bananes plantain frites', 'accompagnement'),
      await create('Salade fraîche', 'accompagnement'),
    ],
    viandes: [await create('Poulet grillé', 'viande'), await create('Bœuf sauté', 'viande')],
  };
}

export async function login(identifiant: string, motDePasse: string): Promise<string> {
  const res = await api.post('/api/auth/login').send({ identifiant, motDePasse });
  if (res.status !== 200) {
    throw new Error(`Connexion impossible pour ${identifiant} : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}
