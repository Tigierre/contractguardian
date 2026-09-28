import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/src/lib/db';
import { analyses, contracts, type Analysis, type Contract } from '@/db/schema';

// =============================================================================
// Proprietà delle risorse — un unico punto per la regola «solo il proprietario»
// =============================================================================
// Contratti e analisi hanno id seriali, quindi indovinabili: ogni lettura che parte
// da un id arrivato dal client deve filtrare per proprietario NELLA QUERY, non dopo.
// Una risorsa di un altro utente, o cestinata, è trattata come inesistente (il
// chiamante risponde 404, non 403: non si conferma l'esistenza di dati altrui).
// -----------------------------------------------------------------------------

export interface OwnedAnalysis {
  analysis: Analysis;
  contract: Contract;
}

/**
 * Carica un'analisi SOLO se il contratto a cui appartiene è del proprietario indicato
 * e non è nel cestino. Restituisce `null` in tutti gli altri casi (inesistente,
 * altrui, contratto cestinato), senza distinguerli.
 */
export async function findOwnedAnalysis(
  analysisId: number,
  owner: string
): Promise<OwnedAnalysis | null> {
  if (!owner) return null;
  const [row] = await db
    .select({ analysis: analyses, contract: contracts })
    .from(analyses)
    .innerJoin(contracts, eq(contracts.id, analyses.contractId))
    .where(
      and(
        eq(analyses.id, analysisId),
        eq(contracts.owner, owner),
        isNull(contracts.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}
