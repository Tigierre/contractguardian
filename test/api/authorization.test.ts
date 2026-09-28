/**
 * Autorizzazione delle route API, contro un PostgreSQL in-process (PGlite) con
 * le migrazioni vere del progetto.
 *
 * Tre regole, verificate route per route:
 *  1. senza identità dal proxy (in produzione) → 403, prima di toccare i dati;
 *  2. risorsa di un altro utente → 404, come se non esistesse (mai 403, mai 400);
 *  3. funzioni admin senza privilegio validato → 403.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

vi.mock('@/src/lib/db', async () => {
  const { createTestDb } = await import('../helpers/db');
  return { db: await createTestDb() };
});

// Il job di estrazione (OCR, pdf) non serve a questi test: l'upload viene
// verificato solo nei suoi controlli d'accesso e di dimensione.
vi.mock('@/lib/pdf/extraction-job', () => ({ runExtraction: vi.fn(async () => {}) }));

import { db } from '@/src/lib/db';
import { analyses, auditLog, contracts, findings } from '@/db/schema';
import { makeRequest, idParams, json, BASE_URL } from '../helpers/http';
import { startTestIssuer, type TestIssuer } from '../helpers/jwks';

import { GET as getAnalysis } from '@/app/api/analyze/[id]/route';
import { POST as postAnalyze } from '@/app/api/analyze/route';
import { GET as listContracts } from '@/app/api/contracts/route';
import { DELETE as deleteContract } from '@/app/api/contracts/[id]/route';
import { GET as listAnalyses } from '@/app/api/contracts/[id]/analyses/route';
import { GET as getExtraction } from '@/app/api/contracts/[id]/extraction/route';
import { GET as getPreAnalysis, POST as postPreAnalysis } from '@/app/api/contracts/[id]/pre-analyze/route';
import { PATCH as patchValidate } from '@/app/api/contracts/[id]/validate/route';
import { POST as postRestore } from '@/app/api/contracts/[id]/restore/route';
import { POST as postMerge } from '@/app/api/contracts/merge/route';
import { GET as listTrash, DELETE as purgeTrash } from '@/app/api/contracts/trash/route';
import { GET as exportReport } from '@/app/api/report/[id]/export/route';
import { POST as postUpload } from '@/app/api/upload/route';

// -----------------------------------------------------------------------------
// Dati: alice e bob, ognuno con i propri contratti e analisi
// -----------------------------------------------------------------------------
const ids = {
  aliceContract: 0,
  aliceTrashedContract: 0,
  bobContract: 0,
  bobSecondContract: 0,
  bobTrashedContract: 0,
  aliceAnalysis: 0,
  aliceTrashedAnalysis: 0,
  bobAnalysis: 0,
  bobProcessingAnalysis: 0,
};

async function insertContract(owner: string, filename: string, deleted = false) {
  const [row] = await db
    .insert(contracts)
    .values({
      filename,
      originalText: 'Testo del contratto di prova. '.repeat(10),
      owner,
      status: 'uploaded',
      contractType: 'servizio',
      jurisdiction: 'italia',
      ...(deleted ? { deletedAt: new Date(), deletedBy: owner } : {}),
    })
    .returning();
  return row!.id;
}

async function insertAnalysis(contractId: number, status: string) {
  const [row] = await db
    .insert(analyses)
    .values({
      contractId,
      status,
      executiveSummary: status === 'completed' ? 'Riepilogo di prova.' : null,
      completedAt: status === 'completed' ? new Date() : null,
      totalFindings: 2,
      importanteCount: 1,
      strengthCount: 1,
      enhanced: 'true',
    })
    .returning();
  return row!.id;
}

beforeAll(async () => {
  ids.aliceContract = await insertContract('alice', 'alice.pdf');
  ids.aliceTrashedContract = await insertContract('alice', 'alice-cestinato.pdf', true);
  ids.bobContract = await insertContract('bob', 'bob.pdf');
  ids.bobSecondContract = await insertContract('bob', 'bob-2.pdf');
  ids.bobTrashedContract = await insertContract('bob', 'bob-cestinato.pdf', true);

  ids.aliceAnalysis = await insertAnalysis(ids.aliceContract, 'completed');
  ids.aliceTrashedAnalysis = await insertAnalysis(ids.aliceTrashedContract, 'completed');
  ids.bobAnalysis = await insertAnalysis(ids.bobContract, 'completed');
  ids.bobProcessingAnalysis = await insertAnalysis(ids.bobSecondContract, 'processing');

  await db.insert(findings).values([
    {
      analysisId: ids.aliceAnalysis,
      title: 'Norme valide',
      type: 'improvement',
      clauseText: 'Clausola A',
      severity: 'importante',
      explanation: 'Spiegazione A',
      actor: 'partyA',
      normIds: JSON.stringify(['it-cc-1341', 42]),
    },
    {
      analysisId: ids.aliceAnalysis,
      title: 'Norme malformate',
      type: 'strength',
      clauseText: 'Clausola B',
      severity: 'suggerimento',
      explanation: 'Spiegazione B',
      actor: 'general',
      normIds: '{non è json',
    },
  ]);
});

beforeEach(() => {
  // In produzione manca il ripiego dell'utente di sviluppo: senza header → 403.
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CG_ADMIN_GROUP', 'cg-admin');
  vi.stubEnv('AUTHENTIK_JWKS_URL', '');
  vi.stubEnv('AUTHENTIK_JWT_ISSUER', '');
  vi.stubEnv('AUTHENTIK_JWT_AUDIENCE', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// 1. Senza identità → 403
// -----------------------------------------------------------------------------
describe('senza identità dal proxy (produzione)', () => {
  const jsonBody = (o: unknown) => ({
    body: JSON.stringify(o),
    headers: { 'content-type': 'application/json' },
  });

  const cases: Array<[string, () => Promise<Response>]> = [
    ['GET /api/analyze/[id]', () => getAnalysis(makeRequest(`/api/analyze/${ids.aliceAnalysis}`), idParams(ids.aliceAnalysis))],
    ['POST /api/analyze', () => postAnalyze(makeRequest('/api/analyze', { method: 'POST', ...jsonBody({ contractId: ids.aliceContract }) }))],
    ['GET /api/contracts', () => listContracts(makeRequest('/api/contracts'))],
    ['DELETE /api/contracts/[id]', () => deleteContract(makeRequest(`/api/contracts/${ids.aliceContract}`, { method: 'DELETE' }), idParams(ids.aliceContract))],
    ['GET /api/contracts/[id]/analyses', () => listAnalyses(makeRequest(`/api/contracts/${ids.aliceContract}/analyses`), idParams(ids.aliceContract))],
    ['GET /api/contracts/[id]/extraction', () => getExtraction(makeRequest(`/api/contracts/${ids.aliceContract}/extraction`), idParams(ids.aliceContract))],
    ['GET /api/contracts/[id]/pre-analyze', () => getPreAnalysis(makeRequest(`/api/contracts/${ids.aliceContract}/pre-analyze`), idParams(ids.aliceContract))],
    ['POST /api/contracts/[id]/pre-analyze', () => postPreAnalysis(makeRequest(`/api/contracts/${ids.aliceContract}/pre-analyze`, { method: 'POST', ...jsonBody({}) }), idParams(ids.aliceContract))],
    ['PATCH /api/contracts/[id]/validate', () => patchValidate(makeRequest(`/api/contracts/${ids.aliceContract}/validate`, { method: 'PATCH', ...jsonBody({}) }), idParams(ids.aliceContract))],
    ['POST /api/contracts/merge', () => postMerge(makeRequest('/api/contracts/merge', { method: 'POST', ...jsonBody({ contractIds: [ids.aliceContract, ids.bobContract] }) }))],
    ['GET /api/report/[id]/export', () => exportReport(makeRequest(`/api/report/${ids.aliceAnalysis}/export`), idParams(ids.aliceAnalysis))],
    ['POST /api/upload', () => postUpload(makeRequest('/api/upload', { method: 'POST', body: new FormData() }))],
    ['GET /api/contracts/trash', () => listTrash(makeRequest('/api/contracts/trash'))],
    ['DELETE /api/contracts/trash', () => purgeTrash(makeRequest('/api/contracts/trash', { method: 'DELETE' }))],
    ['POST /api/contracts/[id]/restore', () => postRestore(makeRequest(`/api/contracts/${ids.aliceTrashedContract}/restore`, { method: 'POST' }), idParams(ids.aliceTrashedContract))],
  ];

  it.each(cases)('%s → 403', async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('una richiesta anonima non modifica nulla (DELETE)', async () => {
    await deleteContract(makeRequest(`/api/contracts/${ids.aliceContract}`, { method: 'DELETE' }), idParams(ids.aliceContract));
    const [row] = await db.select().from(contracts).where(eq(contracts.id, ids.aliceContract));
    expect(row?.deletedAt).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 2. Risorsa di un altro utente → 404
// -----------------------------------------------------------------------------
describe('risorsa di un altro utente → 404', () => {
  it("GET /api/analyze/[id]: l'analisi di bob non è leggibile da alice", async () => {
    const res = await getAnalysis(makeRequest(`/api/analyze/${ids.bobAnalysis}`, { user: 'alice' }), idParams(ids.bobAnalysis));
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.data).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Riepilogo di prova');
  });

  it('GET /api/analyze/[id]: stessa risposta per un id inesistente (nessuna enumerazione)', async () => {
    const other = await json(await getAnalysis(makeRequest(`/api/analyze/${ids.bobAnalysis}`, { user: 'alice' }), idParams(ids.bobAnalysis)));
    const missing = await json(await getAnalysis(makeRequest('/api/analyze/999999', { user: 'alice' }), idParams(999999)));
    expect(other.error).toEqual(missing.error);
  });

  it("GET /api/report/[id]/export: l'analisi altrui in corso risponde 404, non 400", async () => {
    const res = await exportReport(makeRequest(`/api/report/${ids.bobProcessingAnalysis}/export`, { user: 'alice' }), idParams(ids.bobProcessingAnalysis));
    expect(res.status).toBe(404);
  });

  it('GET /api/report/[id]/export: analisi altrui completata → 404', async () => {
    const res = await exportReport(makeRequest(`/api/report/${ids.bobAnalysis}/export`, { user: 'alice' }), idParams(ids.bobAnalysis));
    expect(res.status).toBe(404);
  });

  it('GET /api/contracts/[id]/analyses → 404', async () => {
    const res = await listAnalyses(makeRequest(`/api/contracts/${ids.bobContract}/analyses`, { user: 'alice' }), idParams(ids.bobContract));
    expect(res.status).toBe(404);
  });

  it('GET /api/contracts/[id]/extraction → 404', async () => {
    const res = await getExtraction(makeRequest(`/api/contracts/${ids.bobContract}/extraction`, { user: 'alice' }), idParams(ids.bobContract));
    expect(res.status).toBe(404);
  });

  it('GET /api/contracts/[id]/pre-analyze → 404', async () => {
    const res = await getPreAnalysis(makeRequest(`/api/contracts/${ids.bobContract}/pre-analyze`, { user: 'alice' }), idParams(ids.bobContract));
    expect(res.status).toBe(404);
  });

  it('POST /api/contracts/[id]/pre-analyze → 404 (nessuna chiamata al modello)', async () => {
    const res = await postPreAnalysis(
      makeRequest(`/api/contracts/${ids.bobContract}/pre-analyze`, { method: 'POST', user: 'alice', body: '{}', headers: { 'content-type': 'application/json' } }),
      idParams(ids.bobContract)
    );
    expect(res.status).toBe(404);
  });

  it('PATCH /api/contracts/[id]/validate → 404 e metadati di bob invariati', async () => {
    const res = await patchValidate(
      makeRequest(`/api/contracts/${ids.bobContract}/validate`, {
        method: 'PATCH',
        user: 'alice',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ partyA: 'X', partyB: 'Y', contractType: 'servizio', jurisdiction: 'italia' }),
      }),
      idParams(ids.bobContract)
    );
    expect(res.status).toBe(404);
    const [row] = await db.select().from(contracts).where(eq(contracts.id, ids.bobContract));
    expect(row?.metadataValidatedAt).toBeNull();
  });

  it('POST /api/analyze con il contratto di bob → 404 e nessuna analisi creata', async () => {
    const before = await db.select().from(analyses).where(eq(analyses.contractId, ids.bobContract));
    const res = await postAnalyze(
      makeRequest('/api/analyze', {
        method: 'POST',
        user: 'alice',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractId: ids.bobContract }),
      })
    );
    expect(res.status).toBe(404);
    const after = await db.select().from(analyses).where(eq(analyses.contractId, ids.bobContract));
    expect(after).toHaveLength(before.length);
  });

  it('DELETE /api/contracts/[id] → 404, contratto di bob intatto, tentativo nell\'audit', async () => {
    const res = await deleteContract(makeRequest(`/api/contracts/${ids.bobContract}`, { method: 'DELETE', user: 'alice' }), idParams(ids.bobContract));
    expect(res.status).toBe(404);
    const [row] = await db.select().from(contracts).where(eq(contracts.id, ids.bobContract));
    expect(row?.deletedAt).toBeNull();
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, 'contract.delete'), eq(auditLog.outcome, 'denied'), eq(auditLog.actor, 'alice')));
    expect(denied.length).toBeGreaterThan(0);
  });

  it('POST /api/contracts/merge con contratti di bob → rifiutato, contratti di bob intatti', async () => {
    const res = await postMerge(
      makeRequest('/api/contracts/merge', {
        method: 'POST',
        user: 'alice',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractIds: [ids.bobContract, ids.bobSecondContract] }),
      })
    );
    expect(res.status).toBe(400);
    const rows = await db.select().from(contracts).where(eq(contracts.owner, 'bob'));
    expect(rows.filter((r) => r.deletedAt === null)).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// Il proprietario vede le proprie risorse (e solo quelle)
// -----------------------------------------------------------------------------
describe('proprietario', () => {
  it("GET /api/analyze/[id]: alice legge la propria analisi; normIds malformati non rompono la risposta", async () => {
    const res = await getAnalysis(makeRequest(`/api/analyze/${ids.aliceAnalysis}`, { user: 'alice' }), idParams(ids.aliceAnalysis));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.id).toBe(ids.aliceAnalysis);
    expect(body.data.findings).toHaveLength(2);
    const byTitle = Object.fromEntries(body.data.findings.map((f: { title: string; normIds: string[] }) => [f.title, f.normIds]));
    expect(byTitle['Norme valide']).toEqual(['it-cc-1341']);
    expect(byTitle['Norme malformate']).toEqual([]);
  });

  it('GET /api/analyze/[id]: analisi di un contratto nel cestino → 404 anche per il proprietario', async () => {
    const res = await getAnalysis(makeRequest(`/api/analyze/${ids.aliceTrashedAnalysis}`, { user: 'alice' }), idParams(ids.aliceTrashedAnalysis));
    expect(res.status).toBe(404);
  });

  it('GET /api/analyze/[id]: id non numerico → 400', async () => {
    const res = await getAnalysis(makeRequest('/api/analyze/abc', { user: 'alice' }), idParams('abc'));
    expect(res.status).toBe(400);
  });

  it('GET /api/report/[id]/export: alice esporta il proprio report in PDF', async () => {
    const res = await exportReport(makeRequest(`/api/report/${ids.aliceAnalysis}/export`, { user: 'alice' }), idParams(ids.aliceAnalysis));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('GET /api/contracts: ognuno vede solo i propri contratti non cestinati', async () => {
    const body = await json(await listContracts(makeRequest('/api/contracts', { user: 'alice' })));
    const filenames = body.data.map((c: { filename: string }) => c.filename);
    expect(filenames).toContain('alice.pdf');
    expect(filenames).not.toContain('alice-cestinato.pdf');
    expect(filenames.some((f: string) => f.startsWith('bob'))).toBe(false);
  });

  it('DELETE senza Origin same-origin → 403 anche per il proprietario (CSRF)', async () => {
    const res = await deleteContract(
      makeRequest(`/api/contracts/${ids.aliceContract}`, { method: 'DELETE', user: 'alice', headers: { origin: 'https://evil.example' } }),
      idParams(ids.aliceContract)
    );
    expect(res.status).toBe(403);
    const [row] = await db.select().from(contracts).where(eq(contracts.id, ids.aliceContract));
    expect(row?.deletedAt).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// 3. Funzioni admin
// -----------------------------------------------------------------------------
describe('funzioni admin', () => {
  let issuer: TestIssuer;
  let attacker: TestIssuer;

  beforeAll(async () => {
    issuer = await startTestIssuer('idp-key');
    attacker = await startTestIssuer('attacker-key');
  });
  afterAll(async () => {
    await issuer.close();
    await attacker.close();
  });

  const adminCalls = (opts: { user?: string; jwt?: string; headers?: Record<string, string> }): Array<[string, () => Promise<Response>]> => [
    ['GET /api/contracts/trash', () => listTrash(makeRequest('/api/contracts/trash', opts))],
    ['DELETE /api/contracts/trash', () => purgeTrash(makeRequest('/api/contracts/trash', { ...opts, method: 'DELETE' }))],
    ['POST /api/contracts/[id]/restore', () => postRestore(makeRequest(`/api/contracts/${ids.bobTrashedContract}/restore`, { ...opts, method: 'POST' }), idParams(ids.bobTrashedContract))],
  ];

  it('utente autenticato senza JWT → 403 su tutte le funzioni admin', async () => {
    for (const [, call] of adminCalls({ user: 'alice' })) {
      expect((await call()).status).toBe(403);
    }
  });

  it("l'header testuale dei gruppi non concede l'admin", async () => {
    for (const [, call] of adminCalls({ user: 'alice', headers: { 'x-authentik-groups': 'cg-admin' } })) {
      expect((await call()).status).toBe(403);
    }
  });

  it('JWT valido ma senza il gruppo admin → 403', async () => {
    vi.stubEnv('AUTHENTIK_JWKS_URL', issuer.jwksUrl);
    const jwt = await issuer.sign({ sub: 'alice', groups: ['utenti'] });
    for (const [, call] of adminCalls({ user: 'alice', jwt })) {
      expect((await call()).status).toBe(403);
    }
  });

  it('JWKS indicato da un header della richiesta: ignorato (JWT firmato da altri → 403)', async () => {
    const jwt = await attacker.sign({ sub: 'alice', groups: ['cg-admin'] });
    // Senza JWKS configurato: nessun admin, anche se la richiesta indica un JWKS.
    for (const [, call] of adminCalls({ user: 'alice', jwt, headers: { 'x-authentik-meta-jwks': attacker.jwksUrl } })) {
      expect((await call()).status).toBe(403);
    }
    // Con il JWKS configurato: la firma dell'attaccante non valida.
    vi.stubEnv('AUTHENTIK_JWKS_URL', issuer.jwksUrl);
    for (const [, call] of adminCalls({ user: 'alice', jwt, headers: { 'x-authentik-meta-jwks': attacker.jwksUrl } })) {
      expect((await call()).status).toBe(403);
    }
  });

  it("JWT valido con il gruppo admin → l'elenco del cestino è consultabile", async () => {
    vi.stubEnv('AUTHENTIK_JWKS_URL', issuer.jwksUrl);
    const jwt = await issuer.sign({ sub: 'root', groups: ['cg-admin'] });
    const res = await listTrash(makeRequest('/api/contracts/trash', { user: 'root', jwt }));
    expect(res.status).toBe(200);
    const body = await json(res);
    const filenames = body.data.items.map((i: { filename: string }) => i.filename);
    expect(filenames).toEqual(expect.arrayContaining(['alice-cestinato.pdf', 'bob-cestinato.pdf']));
  });
});

// -----------------------------------------------------------------------------
// Upload: il limite di dimensione scatta prima di leggere il corpo
// -----------------------------------------------------------------------------
describe('POST /api/upload — limite di dimensione', () => {
  it('Content-Length oltre il limite → 413 senza leggere il corpo', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    const res = await postUpload(
      makeRequest('/api/upload', {
        method: 'POST',
        user: 'alice',
        headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(200 * 1024 * 1024) },
        body,
      })
    );
    expect(res.status).toBe(413);
    expect((await json(res)).error.code).toBe('PAYLOAD_TOO_LARGE');
    // Al più il primo pezzo che lo stream prepara da sé: nessuna lettura del corpo.
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it('corpo senza Content-Length oltre il limite → 413 interrompendo la lettura', async () => {
    const chunk = new Uint8Array(1024 * 1024); // 1 MiB
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 50) return controller.close(); // 50 MiB al massimo
        sent++;
        controller.enqueue(chunk);
      },
    });
    const res = await postUpload(
      makeRequest('/api/upload', {
        method: 'POST',
        user: 'alice',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        body,
      })
    );
    expect(res.status).toBe(413);
    // Il limite è ~10 MiB: la lettura si ferma molto prima dei 50 MiB offerti.
    expect(sent).toBeLessThan(15);
  });

  it('PDF piccolo del proprietario → 201 e contratto creato a suo nome', async () => {
    const pdf = new Blob([`%PDF-1.4\n${'x'.repeat(200)}\n%%EOF`], { type: 'application/pdf' });
    const form = new FormData();
    form.append('file', pdf, 'nuovo.pdf');
    const res = await postUpload(makeRequest('/api/upload', { method: 'POST', user: 'alice', body: form }));
    expect(res.status).toBe(201);
    const body = await json(res);
    const [row] = await db.select().from(contracts).where(eq(contracts.id, body.data.id));
    expect(row?.owner).toBe('alice');
    expect(row?.status).toBe('extracting');
  });

  it('upload da un\'origine esterna → 403', async () => {
    const res = await postUpload(
      makeRequest('/api/upload', { method: 'POST', user: 'alice', body: new FormData(), headers: { origin: 'https://evil.example' } })
    );
    expect(res.status).toBe(403);
  });
});

// Evita avvisi su variabili non usate se in futuro un blocco viene rimosso.
void BASE_URL;
