/**
 * Privilegio admin: gruppi dal JWT verificato col JWKS configurato in env,
 * con issuer e audience obbligatori quando configurati.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestIssuer, type TestIssuer } from '../helpers/jwks';

const ISSUER = 'https://auth.example.com/application/o/contractguardian/';
const AUDIENCE = 'contractguardian-client-id';

let idp: TestIssuer;

beforeAll(async () => {
  idp = await startTestIssuer('idp-key');
});
afterAll(async () => {
  await idp.close();
});

beforeEach(() => {
  vi.stubEnv('CG_ADMIN_GROUP', 'cg-admin, altri-admin');
  vi.stubEnv('AUTHENTIK_JWKS_URL', idp.jwksUrl);
  vi.stubEnv('AUTHENTIK_JWT_ISSUER', '');
  vi.stubEnv('AUTHENTIK_JWT_AUDIENCE', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function loadAuth() {
  // Modulo fresco a ogni test: la cache del JWKS e l'avviso "una volta sola"
  // non devono passare da un test all'altro.
  vi.resetModules();
  return import('@/lib/auth/context');
}

function headersWith(jwt?: string, extra: Record<string, string> = {}) {
  const h = new Headers(extra);
  if (jwt) h.set('x-authentik-jwt', jwt);
  return { headers: h };
}

describe('isAdmin', () => {
  it('gruppo admin nel JWT valido → true (anche il secondo gruppo della lista)', async () => {
    const { isAdmin } = await loadAuth();
    expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] })))).toBe(true);
    expect(await isAdmin(headersWith(await idp.sign({ groups: ['altri-admin'] })))).toBe(true);
  });

  it('JWT scaduto → false', async () => {
    const { isAdmin } = await loadAuth();
    // Scaduto da un'ora: ben oltre la tolleranza di 30 secondi sugli orologi.
    const jwt = await idp.sign({ groups: ['cg-admin'] }, { expiresIn: Math.floor(Date.now() / 1000) - 3600 });
    expect(await isAdmin(headersWith(jwt))).toBe(false);
  });

  it('CG_ADMIN_GROUP vuota → nessuno è admin', async () => {
    vi.stubEnv('CG_ADMIN_GROUP', '');
    const { isAdmin } = await loadAuth();
    expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] })))).toBe(false);
  });

  it('AUTHENTIK_JWKS_URL assente → false, avviso nei log una sola volta, header JWKS ignorato', async () => {
    vi.stubEnv('AUTHENTIK_JWKS_URL', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { isAdmin } = await loadAuth();
    const jwt = await idp.sign({ groups: ['cg-admin'] });
    const req = headersWith(jwt, { 'x-authentik-meta-jwks': idp.jwksUrl });
    expect(await isAdmin(req)).toBe(false);
    expect(await isAdmin(req)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('AUTHENTIK_JWKS_URL');
  });

  describe('issuer configurato', () => {
    beforeEach(() => vi.stubEnv('AUTHENTIK_JWT_ISSUER', ISSUER));

    it('iss corretto → true', async () => {
      const { isAdmin } = await loadAuth();
      expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] }, { issuer: ISSUER })))).toBe(true);
    });

    it('iss assente → false (il claim diventa obbligatorio)', async () => {
      const { isAdmin } = await loadAuth();
      expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] })))).toBe(false);
    });

    it('iss diverso → false', async () => {
      const { isAdmin } = await loadAuth();
      const jwt = await idp.sign({ groups: ['cg-admin'] }, { issuer: 'https://altro.example.com/' });
      expect(await isAdmin(headersWith(jwt))).toBe(false);
    });
  });

  describe('audience configurata', () => {
    beforeEach(() => vi.stubEnv('AUTHENTIK_JWT_AUDIENCE', AUDIENCE));

    it('aud corretta → true', async () => {
      const { isAdmin } = await loadAuth();
      expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] }, { audience: AUDIENCE })))).toBe(true);
    });

    it('aud assente → false (il claim diventa obbligatorio)', async () => {
      const { isAdmin } = await loadAuth();
      expect(await isAdmin(headersWith(await idp.sign({ groups: ['cg-admin'] })))).toBe(false);
    });

    it('aud di un\'altra applicazione → false', async () => {
      const { isAdmin } = await loadAuth();
      const jwt = await idp.sign({ groups: ['cg-admin'] }, { audience: 'altra-app' });
      expect(await isAdmin(headersWith(jwt))).toBe(false);
    });
  });
});
