import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load .env.local for scripts running outside Next.js
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL non configurato');
}

// CRITICAL: disable prepared statements for Supabase Transaction pooling
// See: .planning/phases/01-fondazione-setup/01-RESEARCH.md Pitfall 2
// Supabase pooler uses "Transaction" mode which doesn't support prepared statements
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle({ client });
