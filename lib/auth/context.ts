import 'server-only';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ForbiddenError } from '@/lib/errors';

// =============================================================================
// Integrazione con Authentik (add-on dell'hub) — fiducia nel PROXY, non nel browser
// =============================================================================
// ContractGuardian NON ha auth propria: gira SEMPRE dietro Traefik forward-auth →
// Authentik (vedi cg/DEPLOY-STANDARD.md §5). L'outpost inietta gli header
// `X-authentik-*` con l'identità dell'utente autenticato.
//
// ⚠️ Perché ci si può fidare dell'header testuale per l'IDENTITÀ (ownership/audit):
//    a monte l'edge dell'hub strippa gli `X-authentik-*` in ingresso
//    (edge-strip-auth-headers, baseline HI-2) → il client NON può iniettarli; ciò che
//    arriva all'app è impostato dall'outpost. Qui usiamo l'identità per attribuzione
//    (ownership dei contratti, attore dell'audit), NON per privilegi: nessuna azione è
//    gated da gruppo in v1. Se in futuro servisse autorizzare per gruppo, derivarlo dal
//    JWT validato col JWKS (pattern portale `auth.ts`), non dall'header testuale.
//
// Fail-closed: in produzione, se manca l'identità (= forward-auth non configurato),
// le route dati rifiutano (403) invece di servire dati senza un proprietario. Così
// l'app "rende concreto" il vincolo «CG sta dietro Authentik» anche se l'edge è mal
// configurato (difesa in profondità, chiude CG-1 dell'audit di sicurezza).
// -----------------------------------------------------------------------------

export interface Identity {
  /** username Authentik — chiave di ownership e attore dell'audit */
  username: string;
  /** email Authentik (display/diagnostica) */
  email: string;
  /** gruppi DICHIARATI dall'header testuale: solo contesto/audit, MAI per i permessi */
  declaredGroups: string[];
  /** true se l'identità arriva da un header Authentik (non dal fallback dev) */
  fromProxy: boolean;
}

type HeaderSource = Pick<NextRequest['headers'], 'get'>;

function splitGroups(raw: string | null): string[] {
  if (!raw) return [];
  // Authentik separa i gruppi con '|' (o ',') nell'header X-authentik-groups.
  return raw
    .split(/[|,]/)
    .map((g) => g.trim())
    .filter(Boolean);
}

/** Legge l'identità dagli header Authentik. Non lancia (per i path che tollerano l'anonimo). */
export function getIdentity(req: { headers: HeaderSource }): Identity {
  const h = req.headers;
  const username =
    h.get('x-authentik-username') ??
    h.get('x-authentik-email') ??
    h.get('x-authentik-uid') ??
    '';
  return {
    username: username.trim(),
    email: (h.get('x-authentik-email') ?? '').trim(),
    declaredGroups: splitGroups(h.get('x-authentik-groups')),
    fromProxy: Boolean(username),
  };
}

/**
 * Identità OBBLIGATORIA per le route dati. In produzione, se l'header Authentik manca,
 * lancia ForbiddenError (403): nessun dato senza un proprietario. In sviluppo (no
 * Authentik) usa un utente fittizio così l'app è eseguibile/testabile in locale.
 */
export function requireIdentity(req: { headers: HeaderSource }): Identity {
  const id = getIdentity(req);
  if (id.username) return id;
  if (process.env.NODE_ENV !== 'production') {
    const dev = (process.env.CG_DEV_USER || 'local-dev').trim();
    return { username: dev, email: '', declaredGroups: [], fromProxy: false };
  }
  throw new ForbiddenError('Identità non disponibile: accesso consentito solo dietro Authentik');
}

// =============================================================================
// F5 — CSRF: same-origin sulle route mutating (pattern portale src/lib/security.ts)
// =============================================================================
// Se Authentik usa un cookie di sessione sul dominio, una pagina esterna potrebbe
// forzare richieste cross-site che cavalcano la sessione. CG è same-origin: nessun
// client legittimo è cross-origin → si rifiuta tutto ciò che non lo è.

/** Lancia ForbiddenError se la richiesta mutating non è same-origin. */
export function assertSameOrigin(req: Request): void {
  const allowed = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  if (origin) {
    if (origin !== allowed) throw new ForbiddenError('Origine non consentita');
    return;
  }
  // Fallback se manca Origin (alcuni browser su same-origin): usa Referer.
  const referer = req.headers.get('referer');
  if (referer && new URL(referer).origin === allowed) return;
  throw new ForbiddenError('Origine non consentita');
}

/** IP client per l'audit (passa per Traefik → X-Forwarded-For). */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim() || null;
  return req.headers.get('x-real-ip');
}

// =============================================================================
// Autorizzazione per ruolo (admin) — gruppi dal JWT VALIDATO, non dall'header
// =============================================================================
// Il ripristino di un contratto cestinato (e lo svuota-cestino) è riservato
// all'admin. Il privilegio NON si deriva dall'header testuale `X-authentik-groups`
// (falsificabile da chi raggiunge il backend, vedi avviso in testa al file): si
// deriva dal claim `groups` del JWT `X-authentik-jwt` VALIDATO contro il JWKS di
// Authentik (firma + exp/nbf [+ iss/aud se configurati]). Stesso pattern del
// portale (src/lib/auth.ts, hardening F3/HI-4), riusato per uniformità d'hub.
//
// Fail-closed: se il JWT manca o non valida, isAdmin = false.
// -----------------------------------------------------------------------------

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

// I gruppi-admin: una o più label Authentik separate da virgola (CG_ADMIN_GROUP).
function adminGroups(): string[] {
  return (env('CG_ADMIN_GROUP') ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

// JWKS remoto cachato per URL (jose gestisce cache + refresh delle chiavi).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, jwks);
  }
  return jwks;
}

/** Risolve l'URL del JWKS: env esplicita → header runtime dell'outpost. */
function resolveJwksUrl(h: HeaderSource): string | null {
  return env('AUTHENTIK_JWKS_URL') ?? h.get('x-authentik-meta-jwks') ?? null;
}

/** Gruppi AUTOREVOLI dal JWT validato col JWKS. `[]` se il JWT manca/non valida. */
async function verifyGroups(h: HeaderSource): Promise<string[]> {
  const jwt = h.get('x-authentik-jwt');
  const jwksUrl = resolveJwksUrl(h);
  if (!jwt || !jwksUrl) return [];
  try {
    const issuer = env('AUTHENTIK_JWT_ISSUER');
    const audience = env('AUTHENTIK_JWT_AUDIENCE');
    const { payload } = await jwtVerify(jwt, getJwks(jwksUrl), {
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
      clockTolerance: 30, // tolleranza minima per skew d'orologio
    });
    const claim = (payload as JWTPayload & { groups?: unknown }).groups;
    return Array.isArray(claim) ? claim.filter((g): g is string => typeof g === 'string') : [];
  } catch (e) {
    // Firma/scadenza/issuer non validi → nessun gruppo autorevole (fail-closed).
    console.error('[auth] verifica JWT fallita:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** true se l'utente appartiene a un gruppo-admin, derivato dai SOLI gruppi validati. */
export async function isAdmin(req: { headers: HeaderSource }): Promise<boolean> {
  const wanted = adminGroups();
  if (wanted.length === 0) return false; // nessun gruppo-admin configurato → nessuno è admin
  const groups = await verifyGroups(req.headers);
  return groups.some((g) => wanted.includes(g));
}

/**
 * Identità OBBLIGATORIA + privilegio admin. Lancia ForbiddenError (403) se non admin.
 * In sviluppo (no Authentik), `CG_DEV_ADMIN=true` concede l'admin all'utente fittizio
 * così il flusso di ripristino/cestino è testabile in locale (come CG_DEV_USER).
 */
export async function requireAdmin(req: { headers: HeaderSource }): Promise<Identity> {
  const id = requireIdentity(req);
  if (process.env.NODE_ENV !== 'production' && !id.fromProxy && env('CG_DEV_ADMIN') === 'true') {
    return id;
  }
  if (!(await isAdmin(req))) {
    throw new ForbiddenError('Azione riservata agli amministratori');
  }
  return id;
}
