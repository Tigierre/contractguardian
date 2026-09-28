/**
 * Lettura difensiva della colonna `findings.norm_ids`.
 *
 * La colonna contiene un array JSON serializzato come testo. Un valore malformato
 * (riga scritta a mano, migrazione parziale, bug futuro) non deve far fallire con
 * un 500 l'intera risposta che la contiene: si restituiscono solo le stringhe
 * valide e, se il JSON non è leggibile, un array vuoto.
 *
 * @module lib/legal-norms/norm-ids
 */
export function parseNormIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}
