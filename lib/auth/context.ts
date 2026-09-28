import 'server-only';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ForbiddenError } from '@/lib/errors';

// =============================================================================
// Identità dal reverse proxy con forward-auth — fiducia nel PROXY, non nel browser
// =============================================================================
// L'app non ha un login proprio: è pensata per stare dietro un reverse proxy con
// forward-auth verso Authentik (per esempio Traefik + outpost Authentik). Il proxy
// autentica l'utente e inoltra all'app gli header `X-authentik-*`.
//
// ⚠️ Requisiti di deploy perché gli header testuali siano affidabili:
//    1. il proxy RIMUOVE gli `X-authentik-*` arrivati dal client prima di inoltrare;
//    2. l'app NON è raggiungibile se non attraverso il proxy.
//    Rispettati questi due punti, l'header testuale basta per l'IDENTITÀ (proprietà
//    dei contratti, attore dell'audit). I PRIVILEGI invece non si derivano mai dagli
//    header testuali: vengono dal JWT firmato, validato col JWKS (vedi più sotto).
//
// Fail-closed: in produzione, se manca l'identità (forward-auth non configurato),
// le route dati rispondono 403 invece di servire dati senza un proprietario.
// -----------------------------------------------------------------------------

export interface Identity {
  /** username dal proxy — chiave di proprietà e attore dell'audit */
  username: string;
  /** email dal proxy (visualizzazione/diagnostica) */
  email: string;
  /** gruppi DICHIARATI dall'header testuale: solo contesto/audit, MAI per i permessi */
  declaredGroups: string[];
  /** true se l'identità arriva dagli header del proxy (non dall'utente di sviluppo) */
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

/** Legge l'identità dagli header del proxy. Non lancia (per i path che tollerano l'anonimo). */
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
 * Identità OBBLIGATORIA per le route dati. In produzione, se gli header del proxy
 * mancano, lancia ForbiddenError (403): nessun dato senza un proprietario. In sviluppo
 * (nessun proxy) usa un utente fittizio così l'app è eseguibile e testabile in locale.
 */
export function requireIdentity(req: { headers: HeaderSource }): Identity {
  const id = getIdentity(req);
  if (id.username) return id;
  if (process.env.NODE_ENV !== 'production') {
    const dev = (process.env.CG_DEV_USER || 'local-dev').trim();
    return { username: dev, email: '', declaredGroups: [], fromProxy: false };
  }
  throw new ForbiddenError('Identità non disponibile: accesso consentito solo tramite il proxy di autenticazione');
}

// =============================================================================
// CSRF: same-origin sulle route che modificano dati
// =============================================================================
// Se il proxy usa un cookie di sessione sul dominio, una pagina esterna potrebbe
// forzare richieste cross-site che cavalcano la sessione. L'app è same-origin:
// nessun client legittimo è cross-origin → si rifiuta tutto ciò che non lo è.

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

/** IP client per l'audit (dal reverse proxy → X-Forwarded-For). */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim() || null;
  return req.headers.get('x-real-ip');
}

// =============================================================================
// Autorizzazione per ruolo (admin) — gruppi dal JWT VALIDATO, non dall'header
// =============================================================================
// Il ripristino di un contratto cestinato e lo svuotamento del cestino sono
// riservati all'admin. Il privilegio NON si deriva dall'header testuale
// `X-authentik-groups` (falsificabile da chi raggiunge il backend): si deriva dal
// claim `groups` del JWT `X-authentik-jwt`, verificato contro il JWKS del provider.
//
// Configurazione (tutta da env, mai da header della richiesta):
//   - CG_ADMIN_GROUP          gruppi che concedono l'admin (lista separata da virgole)
//   - AUTHENTIK_JWKS_URL      URL del JWKS con cui verificare la firma del JWT
//   - AUTHENTIK_JWT_ISSUER    opzionale: se valorizzata, il claim `iss` è obbligatorio
//                             e deve coincidere
//   - AUTHENTIK_JWT_AUDIENCE  opzionale: se valorizzata, il claim `aud` è obbligatorio
//                             e deve contenerla
//
// L'URL del JWKS viene SOLO dall'ambiente: un JWKS indicato dalla richiesta (per
// esempio con un header) permetterebbe a chi raggiunge il backend di presentare un
// JWT firmato con chiavi proprie.
//
// Fail-closed: JWT assente o non valido, JWKS non configurato o irraggiungibile,
// issuer/audience che non coincidono → isAdmin = false.
// -----------------------------------------------------------------------------

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

// I gruppi-admin: una o più label separate da virgola (CG_ADMIN_GROUP).
function adminGroups(): string[] {
  return (env('CG_ADMIN_GROUP') ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

// JWKS remoto cachato per URL (jose gestisce cache e rinnovo delle chiavi).
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, jwks);
  }
  return jwks;
}

// L'avviso di configurazione mancante esce una sola volta per processo: basta a
// chi legge i log, senza riempirli a ogni richiesta.
let warnedMissingJwks = false;

function warnMissingJwksOnce(): void {
  if (warnedMissingJwks) return;
  warnedMissingJwks = true;
  console.warn(
    '[auth] AUTHENTIK_JWKS_URL non configurata: nessun utente riceverà i privilegi ' +
      'di amministratore finché non viene impostata (CG_ADMIN_GROUP è valorizzata).'
  );
}

/** Gruppi AUTOREVOLI dal JWT validato col JWKS. `[]` se il JWT manca o non valida. */
async function verifyGroups(h: HeaderSource): Promise<string[]> {
  const jwt = h.get('x-authentik-jwt');
  if (!jwt) return [];
  const jwksUrl = env('AUTHENTIK_JWKS_URL');
  if (!jwksUrl) {
    warnMissingJwksOnce();
    return [];
  }
  try {
    const issuer = env('AUTHENTIK_JWT_ISSUER');
    const audience = env('AUTHENTIK_JWT_AUDIENCE');
    const { payload } = await jwtVerify(jwt, getJwks(jwksUrl), {
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
      clockTolerance: 30, // tolleranza minima per lo sfasamento degli orologi
    });
    const claim = (payload as JWTPayload & { groups?: unknown }).groups;
    return Array.isArray(claim) ? claim.filter((g): g is string => typeof g === 'string') : [];
  } catch (e) {
    // Firma, scadenza, issuer o audience non validi, JWKS irraggiungibile o URL
    // malformato → nessun gruppo autorevole (fail-closed).
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
 * In sviluppo (nessun proxy), `CG_DEV_ADMIN=true` concede l'admin all'utente fittizio
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
