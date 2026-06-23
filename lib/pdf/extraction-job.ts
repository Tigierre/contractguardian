/**
 * Job di estrazione testo asincrono (CPERF-1 step 2, "OCR vero-async").
 *
 * `POST /api/upload` crea il contratto come 'extracting' e invoca questa funzione
 * in fire-and-forget (stesso schema di runAnalysis): l'estrazione native+OCR gira
 * in background mentre la richiesta HTTP è già tornata al client, che intanto polla
 * lo stato. Così un PDF scansionato pesante non tiene più appesa la POST (rischio
 * timeout proxy/Authentik) e l'utente vede un avanzamento reale.
 *
 * Il buffer del PDF resta in memoria nella closure che ci invoca finché il job
 * termina (file ≤ 10MB, cap imposto dalla route): nessuna persistenza su disco.
 *
 * @module lib/pdf/extraction-job
 */

import { eq } from 'drizzle-orm';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { extractText } from './pipeline';

/**
 * Esegue l'estrazione del testo per un contratto già creato (status 'extracting')
 * e ne scrive l'esito sul record. Non lancia mai: ogni errore viene catturato e
 * persistito come status 'extraction_failed' + extractionError, così il polling
 * del frontend lo può mostrare. Pensata per essere chiamata in fire-and-forget.
 */
export async function runExtraction(contractId: number, buffer: Buffer): Promise<void> {
  try {
    const result = await extractText(buffer);

    await db
      .update(contracts)
      .set({
        originalText: result.text,
        status: 'uploaded',
        pageCount: result.pageCount,
        extractionMethod: result.method,
        ocrConfidence: result.ocrConfidence ?? null,
        qualityWarning: result.qualityWarning ?? null,
        extractionError: null,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Errore durante l’estrazione del testo';
    console.error(`[Extraction] Estrazione fallita per il contratto ${contractId}:`, error);

    await db
      .update(contracts)
      .set({
        status: 'extraction_failed',
        extractionError: message,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId))
      // Se anche l'update di fallimento va in errore (DB irraggiungibile), non
      // c'è altro da fare se non loggare: il contratto resterà 'extracting' e il
      // client andrà in timeout di polling lato suo.
      .catch((dbErr) =>
        console.error(`[Extraction] Impossibile salvare l'errore per ${contractId}:`, dbErr)
      );
  }
}
