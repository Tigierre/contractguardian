/**
 * Errori interni: il dettaglio resta nei log, nel DB e nelle risposte API
 * finisce solo un messaggio pensato per l'utente.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('@/src/lib/db', async () => {
  const { createTestDb } = await import('../helpers/db');
  return { db: await createTestDb() };
});

// Errore "interno" con dettagli che non devono mai arrivare al client.
const INTERNAL = 'connect ECONNREFUSED 192.0.2.10:5432 user=svc_cg password=segreto';

vi.mock('@/lib/ai/analyze', () => ({
  analyzeChunk: vi.fn(async () => {
    throw new Error(INTERNAL);
  }),
  generateExecutiveSummary: vi.fn(),
}));

vi.mock('@/lib/pdf/pipeline', () => ({
  extractText: vi.fn(),
}));

import { db } from '@/src/lib/db';
import { analyses, contracts } from '@/db/schema';
import { runAnalysis } from '@/lib/ai/orchestrator';
import { runExtraction, GENERIC_EXTRACTION_ERROR } from '@/lib/pdf/extraction-job';
import { extractText } from '@/lib/pdf/pipeline';
import { ExtractionError } from '@/lib/errors';
import { AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from '@/lib/ai/retry';
import {
  AnalysisTimeoutError,
  GENERIC_ANALYSIS_ERROR,
  publicAnalysisErrorMessage,
} from '@/lib/ai/public-error';
import { GET as getAnalysis } from '@/app/api/analyze/[id]/route';
import { GET as getExtraction } from '@/app/api/contracts/[id]/extraction/route';
import { makeRequest, idParams, json } from '../helpers/http';

let logged: unknown[][] = [];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function newContract(owner: string, status = 'uploaded') {
  const [row] = await db
    .insert(contracts)
    .values({ filename: 'x.pdf', originalText: 'Testo del contratto. '.repeat(20), owner, status })
    .returning();
  return row!.id;
}

describe('analisi fallita per un errore interno', () => {
  it('salva e restituisce solo il messaggio generico; il dettaglio va nei log', async () => {
    const contractId = await newContract('alice');
    await expect(runAnalysis(contractId)).rejects.toThrow(INTERNAL);

    const [analysis] = await db.select().from(analyses).where(eq(analyses.contractId, contractId));
    expect(analysis?.status).toBe('failed');
    expect(analysis?.errorMessage).toBe(GENERIC_ANALYSIS_ERROR);

    const res = await getAnalysis(makeRequest(`/api/analyze/${analysis!.id}`, { user: 'alice' }), idParams(analysis!.id));
    const body = await json(res);
    expect(body.data.errorMessage).toBe(GENERIC_ANALYSIS_ERROR);
    expect(JSON.stringify(body)).not.toContain('192.0.2.10');
    expect(JSON.stringify(body)).not.toContain('segreto');

    expect(logged.some((args) => args.some((a) => String(a).includes(INTERNAL) || (a instanceof Error && a.message === INTERNAL)))).toBe(true);
  });
});

describe('estrazione fallita', () => {
  it('errore interno → messaggio generico nel DB e nella risposta', async () => {
    vi.mocked(extractText).mockRejectedValueOnce(new Error(INTERNAL));
    const contractId = await newContract('alice', 'extracting');
    await runExtraction(contractId, Buffer.from('%PDF-'));

    const res = await getExtraction(makeRequest(`/api/contracts/${contractId}/extraction`, { user: 'alice' }), idParams(contractId));
    const body = await json(res);
    expect(body.data.status).toBe('extraction_failed');
    expect(body.data.extractionError).toBe(GENERIC_EXTRACTION_ERROR);
    expect(JSON.stringify(body)).not.toContain('192.0.2.10');
  });

  it("esito di qualità del documento (ExtractionError) → il suo messaggio arriva all'utente", async () => {
    const message = 'Qualità OCR troppo bassa (12%) per un\'analisi affidabile.';
    vi.mocked(extractText).mockRejectedValueOnce(new ExtractionError(message));
    const contractId = await newContract('alice', 'extracting');
    await runExtraction(contractId, Buffer.from('%PDF-'));

    const [row] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    expect(row?.extractionError).toBe(message);
  });
});

describe('publicAnalysisErrorMessage', () => {
  it('traduce gli errori noti in messaggi fissi', () => {
    expect(publicAnalysisErrorMessage(new AnalysisTimeoutError('Analisi scaduta'))).toBe('Analisi scaduta');
    expect(publicAnalysisErrorMessage(new AIError('x', AI_ERROR_CODES.OUTPUT_LIMIT))).toBe(AI_ERROR_MESSAGES.OUTPUT_LIMIT);
    expect(publicAnalysisErrorMessage(new AIError('x', AI_ERROR_CODES.RATE_LIMIT))).toMatch(/sovraccarico/);
  });

  it('non restituisce mai il testo di un errore qualsiasi', () => {
    expect(publicAnalysisErrorMessage(new Error(INTERNAL))).toBe(GENERIC_ANALYSIS_ERROR);
    expect(publicAnalysisErrorMessage(new AIError(`AI rifiutato analisi: ${INTERNAL}`, AI_ERROR_CODES.INVALID_REQUEST))).toBe(GENERIC_ANALYSIS_ERROR);
    expect(publicAnalysisErrorMessage('stringa', 'ripiego')).toBe('ripiego');
  });
});
