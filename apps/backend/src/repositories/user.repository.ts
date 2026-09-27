/**
 * Repository pour les utilisateurs (Admin et Clients).
 * Conforme à SPEC.md (section 8) et AG_RULES.md (2.3, 3.4, 4.1).
 */

import { User, Role } from '@prisma/client';
import { prisma } from '../utils/prisma';

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

  async findByNom(nom: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        nom: {
          equals: nom.trim(),
          mode: 'insensitive',
        },
      },
    });
  }

  async create(data: {
    nom: string;
    prenom: string;
    telephone: string;
    role?: Role;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        nom: data.nom.trim(),
        prenom: data.prenom.trim(),
        telephone: data.telephone.trim(),
        role: data.role ?? Role.client,
      },
    });
  }

  async updatePassword(id: number, motDePasseHash: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { motDePasseHash },
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
