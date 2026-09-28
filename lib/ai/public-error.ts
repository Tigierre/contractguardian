/**
 * Messaggi d'errore MOSTRABILI all'utente per analisi e pre-analisi.
 *
 * Gli errori interni (driver del DB, SDK del provider AI, stack di librerie)
 * possono contenere dettagli di infrastruttura: nomi di host, query, parametri,
 * frammenti di risposta del modello. Quel testo resta nei log del server; nel DB
 * e nelle risposte API finisce solo un messaggio scelto da questa tabella.
 *
 * @module lib/ai/public-error
 */

import { AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from './retry';

/** Messaggio generico quando l'errore non è di un tipo noto. */
export const GENERIC_ANALYSIS_ERROR =
  "Analisi non riuscita per un errore interno. Riprova più tardi; se l'errore persiste, contatta l'amministratore.";

/**
 * Tempo massimo superato. Il messaggio è costruito dal codice (mai da input
 * esterni), quindi è sicuro mostrarlo così com'è.
 */
export class AnalysisTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisTimeoutError';
  }
}

/**
 * Traduce un errore qualsiasi in un messaggio sicuro da salvare nel DB e da
 * restituire al client. Il dettaglio originale va loggato dal chiamante.
 */
export function publicAnalysisErrorMessage(
  error: unknown,
  fallback: string = GENERIC_ANALYSIS_ERROR
): string {
  if (error instanceof AnalysisTimeoutError) return error.message;
  if (error instanceof AIError) {
    switch (error.code) {
      case AI_ERROR_CODES.RATE_LIMIT:
      case AI_ERROR_CODES.MAX_RETRIES_EXCEEDED:
        return 'Servizio AI temporaneamente sovraccarico. Riprova tra qualche minuto.';
      case AI_ERROR_CODES.CONNECTION_ERROR:
        return 'Impossibile raggiungere il servizio AI. Riprova tra qualche minuto.';
      case AI_ERROR_CODES.AUTHENTICATION_ERROR:
        return "Servizio AI non configurato correttamente. Contatta l'amministratore.";
      case AI_ERROR_CODES.PARSE_ERROR:
        return AI_ERROR_MESSAGES.PARSE_ERROR;
      default:
        return fallback;
    }
  }
  return fallback;
}
