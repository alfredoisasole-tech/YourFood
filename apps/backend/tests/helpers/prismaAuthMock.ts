/**
 * Double de Prisma pour les tests HTTP sans base : seul `user.findUnique`, utilisé par le middleware
 * `authenticate`, est simulé. L'utilisateur 1 est l'administratrice, les autres sont des clients.
 */

import { vi } from 'vitest';

export const prismaAuthMock = {
  user: {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => ({
      tokenVersion: 0,
      role: where.id === 1 ? 'admin' : 'client',
    })),
  },
};
