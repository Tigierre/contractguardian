import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

  const sql = postgres(url);

  const statements = [
    `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS perspective text`,
    `UPDATE findings SET type = 'improvement' WHERE type IS NULL`,
    `UPDATE analyses SET
      importante_count = COALESCE(
        (SELECT COUNT(*) FROM findings WHERE findings.analysis_id = analyses.id AND severity = 'importante'),
        0
      ),
      consigliato_count = COALESCE(
        (SELECT COUNT(*) FROM findings WHERE findings.analysis_id = analyses.id AND severity = 'consigliato'),
        0
      ),
      suggerimento_count = COALESCE(
        (SELECT COUNT(*) FROM findings WHERE findings.analysis_id = analyses.id AND severity = 'suggerimento'),
        0
      ),
      strength_count = 0`,
    `ALTER TABLE analyses DROP COLUMN IF EXISTS critical_count`,
  ];

  for (const stmt of statements) {
    console.log(`> ${stmt.slice(0, 80)}...`);
    await sql.unsafe(stmt);
    console.log('  OK');
  }

  console.log('Fix complete!');
  await sql.end();
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
