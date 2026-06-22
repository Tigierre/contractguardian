import 'server-only';
import type { NextRequest } from 'next/server';
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
