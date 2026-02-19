/**
 * Database Seed Script
 *
 * Populates the database with default Italian policies for contract analysis.
 * These policies define what the AI should flag during contract review.
 *
 * Run with: npm run db:seed
 *
 * @module db/seed
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db';
import { policies } from './schema';

/**
 * Default Italian policies covering key contract risk areas:
 * - Financial: payment terms, penalties, liability caps
 * - Liability: indemnification, insurance, warranties
 * - Termination: notice periods, auto-renewal, non-compete
 * - Intellectual Property: ownership, licensing
 */
const defaultPolicies = [
  {
    name: 'Soglia penale massima',
    description: 'Penale contrattuale non deve superare €50.000',
    content: `Clausole che prevedono penali superiori a €50.000 devono essere segnalate come CRITICAL.
Penali tra €25.000 e €50.000 sono HIGH.
Penali tra €10.000 e €25.000 sono MEDIUM.
Penali inferiori a €10.000 sono LOW (accettabili).`,
    language: 'it',
    category: 'financial',
  },
  {
    name: 'Termini di pagamento standard',
    description: 'Pagamenti entro Net 30-60 giorni',
    content: `Termini di pagamento oltre Net 60 giorni sono inaccettabili (CRITICAL).
Termini Net 45-60 sono da negoziare (HIGH).
Anticipi superiori al 30% del valore contratto richiedono approvazione (MEDIUM).
Termini Net 30 o inferiori sono accettabili (LOW).`,
    language: 'it',
    category: 'financial',
  },
  {
    name: 'Limitazione di responsabilità',
    description: 'Cap di responsabilità massimo 2x valore annuale contratto',
    content: `Liability cap che supera 2x il valore annuale del contratto deve essere segnalato come HIGH.
Assenza totale di liability cap è CRITICAL.
Cap tra 1x e 2x valore contratto è MEDIUM.
Cap inferiore a 1x valore contratto è LOW (favorevole a noi).`,
    language: 'it',
    category: 'liability',
  },
  {
    name: 'Clausole di indennità reciproca',
    description: 'Indennità deve essere mutua, non unilaterale',
    content: `Clausole di indennizzo unilaterale (solo noi indennizziamo) sono CRITICAL.
Indennizzo che include danni indiretti o consequenziali è HIGH.
Indennizzo limitato a danni diretti è accettabile (MEDIUM).
Indennizzo reciproco e bilanciato è LOW (favorevole).`,
    language: 'it',
    category: 'liability',
  },
  {
    name: 'Non-compete ragionevole',
    description: 'Non-compete non superiore a 6 mesi o ambito regionale',
    content: `Non-compete oltre 12 mesi è CRITICAL.
Non-compete tra 6-12 mesi o ambito nazionale è HIGH.
Non-compete inferiore a 6 mesi limitato a settore specifico è MEDIUM.
Assenza di clausola non-compete è LOW (favorevole).`,
    language: 'it',
    category: 'termination',
  },
  {
    name: 'Preavviso di risoluzione minimo',
    description: 'Preavviso minimo 30 giorni per risoluzione',
    content: `Preavviso inferiore a 15 giorni è CRITICAL.
Preavviso tra 15-30 giorni è HIGH.
Clausole che permettono risoluzione immediata senza giusta causa sono CRITICAL.
Preavviso tra 30-60 giorni è accettabile (MEDIUM).
Preavviso superiore a 60 giorni è LOW (favorevole).`,
    language: 'it',
    category: 'termination',
  },
  {
    name: 'Proprietà intellettuale sviluppata',
    description: 'IP sviluppato deve rimanere di proprietà o licenza perpetua',
    content: `Clausole che assegnano tutto l'IP alla controparte sono CRITICAL.
Assenza di definizione chiara dell'ownership dell'IP sviluppato è HIGH.
Licenza non esclusiva perpetua sull'IP è MEDIUM.
Ownership dell'IP sviluppato rimane a noi è LOW (favorevole).`,
    language: 'it',
    category: 'intellectual_property',
  },
  {
    name: 'Auto-rinnovo con opt-out',
    description: 'Auto-rinnovo deve permettere opt-out con preavviso adeguato',
    content: `Auto-rinnovo senza possibilità di opt-out è CRITICAL.
Auto-rinnovo con preavviso opt-out inferiore a 60 giorni è HIGH.
Auto-rinnovo con preavviso opt-out tra 60-90 giorni è MEDIUM.
Rinnovo solo su consenso esplicito scritto è LOW (favorevole).`,
    language: 'it',
    category: 'termination',
  },
];

/**
 * Seeds the database with default Italian policies.
 *
 * This function is idempotent - it checks for existing policies before inserting.
 * If policies already exist, it skips insertion to avoid duplicates.
 */
export async function seedPolicies(): Promise<void> {
  console.log('🌱 Avvio seeding policy italiane...\n');

  let inserted = 0;
  let skipped = 0;

  for (const policy of defaultPolicies) {
    try {
      await db.insert(policies).values(policy);
      console.log(`  ✓ Policy creata: ${policy.name}`);
      inserted++;
    } catch (error: unknown) {
      // Check for unique constraint violation (policy already exists)
      if (
        error instanceof Error &&
        error.message.includes('duplicate key')
      ) {
        console.log(`  - Policy già esistente: ${policy.name}`);
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`\n✅ Seeding completato:`);
  console.log(`   - Policy inserite: ${inserted}`);
  console.log(`   - Policy già esistenti: ${skipped}`);
  console.log(`   - Totale: ${defaultPolicies.length}`);
}

// Run if called directly (not imported as module)
const isMainModule = require.main === module;

if (isMainModule) {
  seedPolicies()
    .then(() => {
      console.log('\n🎉 Seed completato con successo!');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('\n❌ Errore durante il seed:', error);
      process.exit(1);
    });
}
