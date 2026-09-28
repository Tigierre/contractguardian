/**
 * Sonda /api/health: versione del codice e stato del database.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentVersion, UNKNOWN_VERSION } from '@/lib/ops/version';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('currentVersion', () => {
  it('SOURCE_COMMIT ha la precedenza ed è abbreviato a 7 caratteri', () => {
    expect(currentVersion({ SOURCE_COMMIT: SHA, GIT_COMMIT_SHA: 'fedcba9876' })).toBe('0123456');
  });

  it('SOURCE_COMMIT definita ma vuota NON oscura GIT_COMMIT_SHA', () => {
    expect(currentVersion({ SOURCE_COMMIT: '', GIT_COMMIT_SHA: 'FEDCBA9876543' })).toBe('fedcba9');
    expect(currentVersion({ SOURCE_COMMIT: '   ', GIT_COMMIT_SHA: 'fedcba9876543' })).toBe('fedcba9');
  });

  it('un valore che non è uno SHA (es. HEAD) viene saltato', () => {
    expect(currentVersion({ SOURCE_COMMIT: 'HEAD', RAILWAY_GIT_COMMIT_SHA: 'abcdef1234567' })).toBe('abcdef1');
  });

  it('nessuna fonte → "sconosciuta"', () => {
    expect(currentVersion({})).toBe(UNKNOWN_VERSION);
    expect(currentVersion({ SOURCE_COMMIT: '' })).toBe(UNKNOWN_VERSION);
  });
});

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('@/src/lib/db');
  });

  it('database raggiungibile → 200 con la versione', async () => {
    vi.stubEnv('SOURCE_COMMIT', SHA);
    vi.doMock('@/src/lib/db', async () => {
      const { createTestDb } = await import('../helpers/db');
      return { db: await createTestDb() };
    });
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toMatchObject({ status: 'healthy', versione: '0123456', database: 'connected' });
  });

  it('DATABASE_URL assente → 503, e la versione è comunque riportata', async () => {
    vi.stubEnv('SOURCE_COMMIT', SHA);
    vi.stubEnv('DATABASE_URL', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'unhealthy', versione: '0123456', database: 'disconnected' });
  });
});
