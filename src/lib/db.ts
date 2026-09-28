import { config } from 'dotenv';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load .env.local for scripts running outside Next.js
config({ path: '.env.local', quiet: true });

type Database = PostgresJsDatabase;

let instance: Database | undefined;

/**
 * Crea la connessione al primo utilizzo, non all'import.
 *
 * `next build` importa i moduli delle route per raccogliere i metadati delle
 * pagine: con la connessione creata all'import, la build richiedeva
 * DATABASE_URL anche se non esegue nessuna query. Così l'immagine si costruisce
 * senza segreti, e la variabile mancante emerge alla prima query (la sonda
 * /api/health risponde 503 e il container risulta non sano).
 */
function getDb(): Database {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL non configurato');
    }
    // Prepared statements disabilitati: i pooler in modalità "transaction"
    // (es. Supabase porta 6543, PgBouncer) non li supportano.
    const client = postgres(url, { prepare: false });
    instance = drizzle({ client });
  }
  return instance;
}

/**
 * Istanza Drizzle condivisa. È un proxy verso la connessione vera, creata
 * pigramente da getDb(): per chi la usa non cambia nulla (`db.select()...`).
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
