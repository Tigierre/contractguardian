/**
 * Polling lato client dello stato di estrazione testo (CPERF-1 step 2).
 *
 * Dopo POST /api/upload il contratto è 'extracting': l'estrazione native+OCR gira
 * in background sul server. Questo helper interroga GET /api/contracts/[id]/extraction
 * a intervalli regolari finché lo stato diventa terminale ('uploaded' o
 * 'extraction_failed'), poi restituisce la risposta. Su timeout complessivo lancia.
 *
 * Condiviso da FileUploader e BatchUploader per non duplicare la logica.
 *
 * @module lib/upload/poll-extraction
 */

import type { ApiResponse, ExtractionStatusResponse } from '@/src/types/api';

/** Intervallo fra due poll (ms). */
const POLL_INTERVAL_MS = 2500;

/**
 * Tentativi massimi prima di arrendersi. Deve coprire il caso peggiore lato server
 * (OCR time-box ~4 min + estrazione native): 150 × 2.5s ≈ 6 minuti di margine.
 */
const POLL_MAX_ATTEMPTS = 150;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface PollOptions {
  /** Permette al chiamante di interrompere il polling (es. unmount del componente). */
  isCancelled?: () => boolean;
}

/**
 * Polla lo stato di estrazione di un contratto fino allo stato terminale.
 * Ritorna la risposta finale (status 'uploaded' oppure 'extraction_failed').
 * Lancia su: errore di rete/HTTP non recuperabile, cancellazione, o timeout.
 */
export async function pollExtractionStatus(
  contractId: number,
  opts: PollOptions = {}
): Promise<ExtractionStatusResponse> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (opts.isCancelled?.()) {
      throw new Error('cancelled');
    }

    const res = await fetch(`/api/contracts/${contractId}/extraction`, {
      method: 'GET',
      cache: 'no-store',
    });
    const data: ApiResponse<ExtractionStatusResponse> = await res.json();

    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Errore durante il controllo dello stato');
    }

    if (data.data.status === 'uploaded' || data.data.status === 'extraction_failed') {
      return data.data;
    }

    // Ancora 'extracting': attendi e riprova.
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("L'estrazione del testo sta richiedendo troppo tempo. Riprova più tardi.");
}
