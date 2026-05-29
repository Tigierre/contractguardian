#!/usr/bin/env node
/**
 * Boot-time migration runner.
 *
 * Uses drizzle-orm's programmatic migrator (no drizzle-kit needed at runtime).
 * Applies any pending SQL migrations from ./db/migrations before the server
 * starts. Safe to run on every boot: applied migrations are tracked in the
 * __drizzle_migrations table and skipped on subsequent runs.
 *
 * Exits non-zero on failure so the container restarts and surfaces the issue.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL not set — skipping migrations');
  process.exit(0);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql);

try {
  console.log('[migrate] applying pending migrations…');
  await migrate(db, { migrationsFolder: './db/migrations' });
  console.log('[migrate] done.');
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
}
