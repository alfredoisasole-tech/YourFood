/**
 * Crée (ou met à jour) le compte administrateur — à utiliser en production à la place du seed,
 * qui contient des mots de passe de démonstration connus.
 *
 * Usage (depuis apps/backend, DATABASE_URL pointant vers la base voulue) :
 *   ADMIN_PRENOM="Sarah" ADMIN_NOM="BOKETSU" ADMIN_PASSWORD="un-mot-de-passe-long" npm run create-admin
 *
 * Si ADMIN_PASSWORD est absent, il est demandé au clavier (la saisie reste visible : à éviter sur
 * une machine partagée). Relancer la commande avec le même nom change le mot de passe de ce compte.
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { passwordSchema } from '@meal-app/shared';
import { buildLoginKey } from '../src/utils/loginKey';

const BCRYPT_ROUNDS = 12;

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const prenom = process.env.ADMIN_PRENOM?.trim() || (await ask('Prénom de l\'administratrice : '));
  const nom = process.env.ADMIN_NOM?.trim() || (await ask('Nom de l\'administratrice : '));
  const password = process.env.ADMIN_PASSWORD || (await ask('Mot de passe (12 caractères minimum) : '));

  if (!prenom || !nom) {
    throw new Error('Le prénom et le nom sont obligatoires.');
  }
  const check = passwordSchema.safeParse(password);
  if (!check.success || password.length < 12) {
    throw new Error('Le mot de passe doit compter au moins 12 caractères.');
  }

  const prisma = new PrismaClient();
  try {
    const loginKey = buildLoginKey(prenom, nom);
    const motDePasseHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const existing = await prisma.user.findUnique({ where: { loginKey } });
    if (existing && existing.role !== Role.admin) {
      throw new Error('Un client porte déjà ce nom : choisis un autre nom pour l\'administratrice.');
    }

    const admins = await prisma.user.count({ where: { role: Role.admin } });
    if (!existing && admins > 0) {
      console.warn(`⚠️  ${admins} administrateur(s) existe(nt) déjà : ce compte s'ajoute aux autres.`);
    }

    await prisma.user.upsert({
      where: { loginKey },
      // tokenVersion incrémenté : les sessions ouvertes avec l'ancien mot de passe sont fermées
      update: { motDePasseHash, tokenVersion: { increment: 1 } },
      create: { nom, prenom, loginKey, role: Role.admin, motDePasseHash },
    });

    console.log(`✅ Compte administrateur ${existing ? 'mis à jour' : 'créé'} : identifiant de connexion « ${prenom} ${nom} »`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
