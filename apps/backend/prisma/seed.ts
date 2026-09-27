/**
 * Script de Seed Idempotent pour YourFood.
 * Conforme à SPEC.md (sections 4, 5, 8) et AG_RULES.md (2.1, 2.2, 3.1, 3.4, 4.2).
 *
 * Initialise :
 * 1. Un compte administrateur initial (mot de passe haché bcrypt).
 * 2. Un catalogue complet de plats congolais (plats, accompagnements, viandes).
 * 3. Deux clients types (formule 25 000 FC et formule 35 000 FC) avec abonnements actifs et codes d'activation.
 * 4. Une offre du jour prête à l'emploi avec exactement 6 options (2 par catégorie).
 */

import {
  PrismaClient,
  Role,
  CategorieItem,
  Formule,
  StatutAbonnement,
  TypeAccessCode,
  StatutOffre,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Africa/Kinshasa');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function main() {
  console.log('🌱 Démarrage du seed YourFood (fuseau : Africa/Kinshasa)...');

  // ─── 1. Compte Administrateur Initial ───────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin@2026!', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { telephone: '+243810000001' },
    update: {
      nom: 'BOKETSU',
      prenom: 'Sarah',
      role: Role.admin,
      motDePasseHash: adminPasswordHash,
    },
    create: {
      nom: 'BOKETSU',
      prenom: 'Sarah',
      telephone: '+243810000001',
      role: Role.admin,
      motDePasseHash: adminPasswordHash,
    },
  });
  console.log(`👤 Administrateur configuré : ${admin.nom} ${admin.prenom} (${admin.telephone})`);

  // ─── 2. Catalogue de Plats (Gastronomie congolaise / locale) ───
  const catalogItems = [
    // Plats principaux
    { nom: 'Poulet à la Moambé', categorie: CategorieItem.plat },
    { nom: 'Maboke de Capitaine en papillote', categorie: CategorieItem.plat },
    { nom: 'Poisson Braisé aux épices douces', categorie: CategorieItem.plat },
    { nom: 'Bœuf sauté aux légumes locaux', categorie: CategorieItem.plat },
    // Accompagnements
    { nom: 'Fufu de maïs et manioc', categorie: CategorieItem.accompagnement },
    { nom: 'Chikwangue artisanale', categorie: CategorieItem.accompagnement },
    { nom: 'Riz blanc parfumé', categorie: CategorieItem.accompagnement },
    { nom: 'Bananes plantains frites (Makemba)', categorie: CategorieItem.accompagnement },
    { nom: 'Pommes sautées croustillantes', categorie: CategorieItem.accompagnement },
    // Viandes
    { nom: 'Kamundele (Brochettes de chèvre braisée)', categorie: CategorieItem.viande },
    { nom: 'Poulet Mayo braisé à la kinois', categorie: CategorieItem.viande },
    { nom: 'Côtelettes de porc dorées', categorie: CategorieItem.viande },
    { nom: 'Viande de bœuf fumée à la sauce tomate', categorie: CategorieItem.viande },
  ];

  const createdItems = new Map<string, number>();

  for (const item of catalogItems) {
    const existing = await prisma.catalogItem.findFirst({
      where: { nom: item.nom },
    });

    if (existing) {
      createdItems.set(item.nom, existing.id);
    } else {
      const created = await prisma.catalogItem.create({
        data: {
          nom: item.nom,
          categorie: item.categorie,
          actif: true,
        },
      });
      createdItems.set(item.nom, created.id);
    }
  }
  console.log(`🍽️  Catalogue initialisé avec ${createdItems.size} plats, accompagnements et viandes.`);

  // ─── 3. Clients de Démonstration ────────────────────────────────
  const todayStr = dayjs().tz('Africa/Kinshasa').format('YYYY-MM-DD');
  const todayDate = dayjs(todayStr).toDate();
  const endDate = dayjs(todayStr).add(30, 'day').toDate();

  // Client 1 : Formule 25 000 FC (viande lundi et vendredi uniquement)
  const client1 = await prisma.user.upsert({
    where: { telephone: '+243812345678' },
    update: { nom: 'KABAMBA', prenom: 'Patrick', role: Role.client },
    create: {
      nom: 'KABAMBA',
      prenom: 'Patrick',
      telephone: '+243812345678',
      role: Role.client,
    },
  });

  const sub1 = await prisma.subscription.findFirst({
    where: { userId: client1.id, statut: StatutAbonnement.actif },
  }) ?? await prisma.subscription.create({
    data: {
      userId: client1.id,
      formule: Formule.F_25000,
      dateDebut: todayDate,
      dateFin: endDate,
      statut: StatutAbonnement.actif,
      bonus: 'Pack découverte',
    },
  });

  await prisma.accessCode.upsert({
    where: { code: 'KP7X8A9B' },
    update: { subscriptionId: sub1.id, utilise: false },
    create: {
      code: 'KP7X8A9B',
      subscriptionId: sub1.id,
      type: TypeAccessCode.activation,
      utilise: false,
    },
  });
  console.log(`👤 Client 1 (25 000 FC) : ${client1.nom} ${client1.prenom} | Code : KP7X8A9B`);

  // Client 2 : Formule 35 000 FC (viande tous les jours ouvrés)
  const client2 = await prisma.user.upsert({
    where: { telephone: '+243823456789' },
    update: { nom: 'MUTOMBO', prenom: 'Jean', role: Role.client },
    create: {
      nom: 'MUTOMBO',
      prenom: 'Jean',
      telephone: '+243823456789',
      role: Role.client,
    },
  });

  const sub2 = await prisma.subscription.findFirst({
    where: { userId: client2.id, statut: StatutAbonnement.actif },
  }) ?? await prisma.subscription.create({
    data: {
      userId: client2.id,
      formule: Formule.F_35000,
      dateDebut: todayDate,
      dateFin: endDate,
      statut: StatutAbonnement.actif,
    },
  });

  await prisma.accessCode.upsert({
    where: { code: 'MJ4D5E6F' },
    update: { subscriptionId: sub2.id, utilise: false },
    create: {
      code: 'MJ4D5E6F',
      subscriptionId: sub2.id,
      type: TypeAccessCode.activation,
      utilise: false,
    },
  });
  console.log(`👤 Client 2 (35 000 FC) : ${client2.nom} ${client2.prenom} | Code : MJ4D5E6F`);

  // ─── 4. Offre du Jour Conforme (Exactement 6 options : 2x plat, 2x acc, 2x viande) ───
  const selectedItems = [
    createdItems.get('Poulet à la Moambé')!,
    createdItems.get('Poisson Braisé aux épices douces')!,
    createdItems.get('Fufu de maïs et manioc')!,
    createdItems.get('Bananes plantains frites (Makemba)')!,
    createdItems.get('Kamundele (Brochettes de chèvre braisée)')!,
    createdItems.get('Poulet Mayo braisé à la kinois')!,
  ].filter(Boolean);

  const existingOffer = await prisma.dailyOffer.findUnique({
    where: { date: todayDate },
    include: { options: true },
  });

  if (!existingOffer && selectedItems.length === 6) {
    await prisma.dailyOffer.create({
      data: {
        date: todayDate,
        heureLimiteIndicative: '13:00',
        statut: StatutOffre.ouvert,
        options: {
          create: selectedItems.map((catalogItemId) => ({ catalogItemId })),
        },
      },
    });
    console.log(`📅 Offre du jour créée pour le ${todayStr} (6 options : 2 plats, 2 acc, 2 viandes).`);
  } else {
    console.log(`📅 Offre du jour pour le ${todayStr} déjà existante.`);
  }

  console.log('✅ Seed terminé avec succès.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de l\'exécution du seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
