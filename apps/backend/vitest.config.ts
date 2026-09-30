import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Les tests avec base de données partagent une même base : un fichier à la fois
    fileParallelism: false,
  },
});
