/**
 * Repository pour les utilisateurs (Admin et Clients).
 * Conforme à SPEC.md (section 8) et AG_RULES.md (2.3, 3.4, 4.1).
 */

import { User, Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { buildLoginKey, loginKeyCandidates } from '../utils/loginKey';

export class UserRepository {
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByTelephone(telephone: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { telephone },
    });
  }

  async findByLoginKey(loginKey: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { loginKey } });
  }

  /**
   * Retrouve un utilisateur à partir de l'identifiant saisi (« Prénom Nom », ou « Nom Prénom »).
   * La clé est unique en base : il ne peut plus y avoir d'ambiguïté entre deux clients.
   */
  async findByIdentifiant(identifiant: string): Promise<User | null> {
    for (const key of loginKeyCandidates(identifiant)) {
      const user = await this.findByLoginKey(key);
      if (user) {
        return user;
      }
    }
    return null;
  }

  async create(data: {
    nom: string;
    prenom: string;
    telephone?: string | null;
    role?: Role;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        nom: data.nom.trim(),
        prenom: data.prenom.trim(),
        telephone: data.telephone?.trim() || null,
        loginKey: buildLoginKey(data.prenom, data.nom),
        role: data.role ?? Role.client,
      },
    });
  }

  async updatePassword(id: number, motDePasseHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { motDePasseHash, tokenVersion: { increment: 1 } },
    });
  }

  async findAllClients(): Promise<User[]> {
    return prisma.user.findMany({
      where: { role: Role.client },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const userRepository = new UserRepository();
