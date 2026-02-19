import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(url);
  const migrationPath = join(__dirname, 'migrations', '0001_perspective_and_findings_rework.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Split by statements (respecting the -- comments)
  const statements = migrationSQL
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  console.log(`Running ${statements.length} statements...`);

  for (const stmt of statements) {
    console.log(`> ${stmt.slice(0, 80)}...`);
    await sql.unsafe(stmt);
    console.log('  OK');
  }

  console.log('Migration complete!');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
