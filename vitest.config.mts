import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    environment: 'node',
    // PGlite + migrazioni richiedono qualche secondo al primo avvio per file.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': root,
      // `server-only` è un marcatore risolto dal bundler di Next; in Node puro
      // lo sostituisce un modulo vuoto.
      'server-only': path.resolve(root, 'test/stubs/server-only.ts'),
    },
  },
});
