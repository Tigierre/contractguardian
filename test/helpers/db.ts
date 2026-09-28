/**
 * Database di test: PostgreSQL in-process (PGlite) con le migrazioni vere del
 * progetto, trigger dell'audit log compresi. Nessun server esterno, nessuna rete.
 *
 * Uso tipico in un file di test:
 *
 *   vi.mock('@/src/lib/db', async () => {
 *     const { createTestDb } = await import('../helpers/db');
 *     return { db: await createTestDb() };
 *   });
 */
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'db/migrations') });
  return db;
}
