/**
 * Script de Seed Idempotent pour YourFood.
 * Conforme à SPEC.md (sections 4, 5, 8) et AG_RULES.md (2.1, 2.2, 3.1, 3.4, 4.2).
 *
 * Initialise :
 * 1. Un compte administrateur initial (mot de passe haché bcrypt).
 * 2. Un catalogue complet de plats congolais (plats, accompagnements, viandes).
 * 3. Quatre clients de démonstration couvrant les cas à tester : abonnement en cours (formule 25 000
 *    et 35 000 FC), abonnement expiré et abonnement pas encore commencé. Tous les abonnements commencent
 *    un lundi et finissent un vendredi.
 * 4. Les menus des prochains jours ouvrés (2 plats, 2 accompagnements, 2 viandes).
 */

import 'dotenv/config';
import {
  PrismaClient,
  Role,
  CategorieItem,
  Formule,
  StatutAbonnement,
  AccessCodeType,
  StatutOffre,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { addDays, computeSubscriptionEnd, nextMonday, isWeekday, dayOfWeek } from '@meal-app/shared';
import { buildLoginKey } from '../src/utils/loginKey';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Africa/Kinshasa');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

/** Date (UTC minuit) attendue par les colonnes @db.Date */
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface DemoClient {
  nom: string;
  prenom: string;
  telephone: string | null;
  formule: Formule;
  debut: string;
  semaines: number;
  /** Code d'activation ; null si le compte est déjà activé */
  code: string | null;
}

async function main() {
  console.log('🌱 Démarrage du seed YourFood (fuseau : Africa/Kinshasa)...');

  const today = dayjs().tz('Africa/Kinshasa').format('YYYY-MM-DD');
  const thisMonday = addDays(today, -((dayOfWeek(today) + 6) % 7));

  // ─── 1. Compte Administrateur Initial ───────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@2026!', BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { loginKey: buildLoginKey('Sarah', 'BOKETSU') },
    update: { role: Role.admin, motDePasseHash: adminPasswordHash },
    create: {
      nom: 'BOKETSU',
      prenom: 'Sarah',
      telephone: '+243810000001',
      loginKey: buildLoginKey('Sarah', 'BOKETSU'),
      role: Role.admin,
      motDePasseHash: adminPasswordHash,
    },
  });
  console.log(`👤 Administrateur : ${admin.prenom} ${admin.nom} (identifiant : « Sarah BOKETSU »)`);

  // ─── 2. Catalogue de Plats (Gastronomie congolaise / locale) ───
  const catalogItems = [
    { nom: 'Poulet à la Moambé', categorie: CategorieItem.plat },
    { nom: 'Maboke de Capitaine en papillote', categorie: CategorieItem.plat },
    { nom: 'Poisson Braisé aux épices douces', categorie: CategorieItem.plat },
    { nom: 'Bœuf sauté aux légumes locaux', categorie: CategorieItem.plat },
    { nom: 'Fufu de maïs et manioc', categorie: CategorieItem.accompagnement },
    { nom: 'Chikwangue artisanale', categorie: CategorieItem.accompagnement },
    { nom: 'Riz blanc parfumé', categorie: CategorieItem.accompagnement },
    { nom: 'Bananes plantains frites (Makemba)', categorie: CategorieItem.accompagnement },
    { nom: 'Pommes sautées croustillantes', categorie: CategorieItem.accompagnement },
    { nom: 'Kamundele (Brochettes de chèvre braisée)', categorie: CategorieItem.viande },
    { nom: 'Poulet Mayo braisé à la kinois', categorie: CategorieItem.viande },
    { nom: 'Côtelettes de porc dorées', categorie: CategorieItem.viande },
    { nom: 'Viande de bœuf fumée à la sauce tomate', categorie: CategorieItem.viande },
  ];

  const itemIds = new Map<string, number>();
  for (const item of catalogItems) {
    const existing = await prisma.catalogItem.findFirst({ where: { nom: item.nom } });
    const record =
      existing ??
      (await prisma.catalogItem.create({
        data: { nom: item.nom, categorie: item.categorie, actif: true },
      }));
    itemIds.set(item.nom, record.id);
  }
  console.log(`🍽️  Catalogue initialisé avec ${itemIds.size} plats, accompagnements et viandes.`);

  // ─── 3. Clients de Démonstration ────────────────────────────────
  const demoClients: DemoClient[] = [
    {
      nom: 'KABAMBA',
      prenom: 'Patrick',
      telephone: '+243812345678',
      formule: Formule.F_25000,
      debut: thisMonday,
      semaines: 4,
      code: 'KP7X8A9B',
    },
    {
      nom: 'MUTOMBO',
      prenom: 'Jean',
      telephone: '+243823456789',
      formule: Formule.F_35000,
      debut: thisMonday,
      semaines: 4,
      code: 'MJ4D5E6F',
    },
    {
      // Abonnement terminé la semaine dernière : pour tester l'accès grisé (SPEC 5.11)
      nom: 'KALALA',
      prenom: 'Freddy',
      telephone: null,
      formule: Formule.F_35000,
      debut: addDays(thisMonday, -14),
      semaines: 2,
      code: null,
    },
    {
      // Abonnement qui commence lundi prochain : pour tester « pas encore actif »
      nom: 'MWAMBA',
      prenom: 'Grâce',
      telephone: '+243841039965',
      formule: Formule.F_25000,
      debut: nextMonday(today),
      semaines: 1,
      code: 'MG5H6J7K',
    },
  ];

  const clientPasswordHash = await bcrypt.hash('Client@2026!', BCRYPT_ROUNDS);

  for (const demo of demoClients) {
    const loginKey = buildLoginKey(demo.prenom, demo.nom);
    const user = await prisma.user.upsert({
      where: { loginKey },
      update: {},
      create: {
        nom: demo.nom,
        prenom: demo.prenom,
        telephone: demo.telephone,
        loginKey,
        role: Role.client,
        // Un client déjà activé (sans code) reçoit un mot de passe de démonstration
        motDePasseHash: demo.code ? null : clientPasswordHash,
      },
    });

    const dateFin = computeSubscriptionEnd(demo.debut, demo.semaines);
    const existingSub = await prisma.subscription.findFirst({ where: { userId: user.id } });
    const subscription =
      existingSub ??
      (await prisma.subscription.create({
        data: {
          userId: user.id,
          formule: demo.formule,
          dateDebut: toDbDate(demo.debut),
          dateFin: toDbDate(dateFin),
          statut: dateFin < today ? StatutAbonnement.expire : StatutAbonnement.actif,
        },
      }));

    if (demo.code) {
      await prisma.accessCode.upsert({
        where: { code: demo.code },
        update: { subscriptionId: subscription.id, utilise: false },
        create: {
          code: demo.code,
          subscriptionId: subscription.id,
          type: AccessCodeType.activation,
          utilise: false,
        },
      });
    }

    const access = demo.code ? `code ${demo.code}` : 'mot de passe Client@2026!';
    console.log(
      `👤 ${demo.prenom} ${demo.nom} : ${demo.debut} → ${dateFin} (${demo.formule === Formule.F_35000 ? '35 000' : '25 000'} FC) | ${access}`
    );
  }

  // ─── 4. Menus des prochains jours ouvrés ────────────────────────
  const menuItems = [
    'Poulet à la Moambé',
    'Poisson Braisé aux épices douces',
    'Fufu de maïs et manioc',
    'Bananes plantains frites (Makemba)',
    'Kamundele (Brochettes de chèvre braisée)',
    'Poulet Mayo braisé à la kinois',
  ].map((nom) => itemIds.get(nom) as number);

  const menuDays: string[] = [];
  for (let day = today; menuDays.length < 3; day = addDays(day, 1)) {
    if (isWeekday(day)) menuDays.push(day);
  }

  for (const day of menuDays) {
    const existing = await prisma.dailyOffer.findUnique({ where: { date: toDbDate(day) } });
    if (existing) continue;
    await prisma.dailyOffer.create({
      data: {
        date: toDbDate(day),
        heureLimiteIndicative: '13:00',
        statut: StatutOffre.ouvert,
        options: { create: menuItems.map((catalogItemId) => ({ catalogItemId })) },
      },
    });
  }
  console.log(`📅 Menus publiés pour : ${menuDays.join(', ')}`);

  console.log('✅ Seed terminé avec succès.');
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors de l'exécution du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
