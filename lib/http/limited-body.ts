/**
 * Lettura del corpo di una richiesta con un tetto di byte.
 *
 * `request.formData()` legge TUTTO il corpo in memoria prima che si possa
 * controllare la dimensione del file: con un upload da centinaia di MB il processo
 * alloca prima e rifiuta poi. Qui il controllo avviene in due punti:
 *
 *  1. `Content-Length` dichiarato oltre il limite → rifiuto immediato, senza
 *     leggere un solo byte del corpo;
 *  2. corpo senza `Content-Length` (transfer chunked) → lettura in streaming che si
 *     interrompe appena si supera il limite.
 *
 * @module lib/http/limited-body
 */

import { PayloadTooLargeError, ValidationError } from '@/lib/errors';

/**
 * Margine per l'involucro multipart (boundary, intestazioni della parte, nome
 * del file). 64 KiB coprono ampiamente un singolo file con un nome lungo.
 */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Rifiuta la richiesta se `Content-Length` supera `maxBytes`.
 * Lancia PayloadTooLargeError (413) o ValidationError (400) se l'header è malformato.
 */
export function assertContentLengthWithin(
  headers: Pick<Headers, 'get'>,
  maxBytes: number,
  message?: string
): void {
  const raw = headers.get('content-length');
  if (raw === null) return; // assente: ci pensa la lettura in streaming
  const declared = Number(raw);
  if (!Number.isFinite(declared) || declared < 0 || !Number.isInteger(declared)) {
    throw new ValidationError('Intestazione Content-Length non valida');
  }
  if (declared > maxBytes) {
    throw new PayloadTooLargeError(message);
  }
}

/**
 * Legge il corpo della richiesta fermandosi appena supera `maxBytes`.
 * Lancia PayloadTooLargeError (413) senza accumulare il resto del corpo.
 */
export async function readBodyWithLimit(
  req: Request,
  maxBytes: number,
  message?: string
): Promise<Uint8Array> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new PayloadTooLargeError(message);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * `formData()` con tetto di dimensione: controlla `Content-Length`, legge il corpo
 * in streaming con lo stesso tetto e solo allora lo interpreta come multipart.
 */
export async function formDataWithLimit(
  req: Request,
  maxBytes: number,
  message?: string
): Promise<FormData> {
  assertContentLengthWithin(req.headers, maxBytes, message);
  const body = await readBodyWithLimit(req, maxBytes, message);
  const contentType = req.headers.get('content-type') ?? '';
  return new Response(body as BodyInit, {
    headers: { 'content-type': contentType },
  }).formData();
}
