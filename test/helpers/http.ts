/**
 * Costruzione di richieste per chiamare direttamente i route handler di Next.
 */
import { NextRequest } from 'next/server';

export const BASE_URL = 'http://cg.test';

export interface RequestOptions {
  method?: string;
  /** Username inoltrato dal proxy (header x-authentik-username). Assente = anonimo. */
  user?: string;
  /** JWT inoltrato dal proxy (header x-authentik-jwt). */
  jwt?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  /** Aggiunge Origin = BASE_URL sulle richieste non-GET (default true). */
  sameOrigin?: boolean;
}

export function makeRequest(pathname: string, opts: RequestOptions = {}): NextRequest {
  const method = opts.method ?? 'GET';
  const headers = new Headers(opts.headers);
  if (opts.user) {
    headers.set('x-authentik-username', opts.user);
    headers.set('x-authentik-email', `${opts.user}@example.com`);
  }
  if (opts.jwt) headers.set('x-authentik-jwt', opts.jwt);
  if (method !== 'GET' && opts.sameOrigin !== false && !headers.has('origin')) {
    headers.set('origin', BASE_URL);
  }
  const init: ConstructorParameters<typeof NextRequest>[1] = { method, headers };
  if (opts.body !== undefined && opts.body !== null) {
    init.body = opts.body;
    // Necessario in Node per i corpi in streaming.
    (init as { duplex?: string }).duplex = 'half';
  }
  return new NextRequest(BASE_URL + pathname, init);
}

/** Secondo argomento dei route handler dinamici: `{ params: Promise<{ id }> }`. */
export function idParams(id: number | string) {
  return { params: Promise.resolve({ id: String(id) }) };
}

export async function json(res: Response): Promise<{ success: boolean; data?: any; error?: any }> {
  return res.json();
}
