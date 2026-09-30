/**
 * Build de production du backend : un seul fichier `dist/index.js`.
 *
 * Le paquet partagé (@meal-app/shared) est publié en TypeScript ; Node ne peut pas l'exécuter tel quel.
 * On l'inclut donc dans le fichier produit, alors que les dépendances npm restent externes
 * (installées sur le serveur, en particulier Prisma et bcrypt qui ont des binaires natifs).
 */

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => name !== '@meal-app/shared');

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external,
  logLevel: 'info',
});
