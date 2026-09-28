/**
 * OpenAI Client Singleton
 *
 * Provides a single, configured OpenAI client instance for the application.
 * Il client è creato al primo utilizzo, non all'import: `next build` importa i
 * moduli delle route senza chiamare il modello, e non deve aver bisogno della
 * chiave. Se OPENAI_API_KEY manca, l'errore emerge alla prima chiamata.
 *
 * @module lib/ai/client
 */

import OpenAI from 'openai';

let instance: OpenAI | undefined;

function getClient(): OpenAI {
  if (!instance) {
    const apiKey = process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, '');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY non configurato');
    }
    instance = new OpenAI({ apiKey });
  }
  return instance;
}

/**
 * Configured OpenAI client instance
 *
 * The client is shared across the application to manage rate limits
 * and connection pooling efficiently. I modelli usati per l'analisi
 * sono definiti sotto (MODEL_PREANALISI, MODEL_ANALISI).
 * È un proxy verso il client vero, creato pigramente da getClient().
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

/**
 * Modello per la pre-analisi (estrazione metadati / triage).
 * Default gpt-5.4-nano: veloce ed economico, tarato su estrazione dati.
 * Override via env `OPENAI_MODEL_PREANALYSIS`.
 */
export const MODEL_PREANALISI =
  process.env.OPENAI_MODEL_PREANALYSIS?.trim() || 'gpt-5.4-nano';

/**
 * Modello per l'analisi delle clausole (chunk analysis + executive summary).
 * Default gpt-5.4-mini: qualità sul ragionamento legale, dove conta.
 * Override via env `OPENAI_MODEL_ANALYSIS`.
 */
export const MODEL_ANALISI =
  process.env.OPENAI_MODEL_ANALYSIS?.trim() || 'gpt-5.4-mini';

/**
 * Legge un tetto di token da env: intero positivo, altrimenti il default.
 */
function tokenCap(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Tetto di token in uscita (`max_completion_tokens`) per ogni chiamata di ANALISI
 * (chunk + riepilogo). Nei modelli con ragionamento il conteggio include anche i
 * token di ragionamento: il tetto limita il costo massimo di una singola chiamata
 * e ferma le risposte fuori controllo. Default 16000, abbondante per il JSON dei
 * finding di un chunk più il ragionamento a sforzo medio.
 * Override via env `OPENAI_MAX_COMPLETION_TOKENS_ANALYSIS`.
 */
export const MAX_COMPLETION_TOKENS_ANALISI = tokenCap(
  'OPENAI_MAX_COMPLETION_TOKENS_ANALYSIS',
  16_000
);

/**
 * Tetto di token in uscita per la PRE-ANALISI (estrazione metadati). La risposta
 * è un JSON piccolo e il ragionamento è a sforzo basso: default 6000.
 * Override via env `OPENAI_MAX_COMPLETION_TOKENS_PREANALYSIS`.
 */
export const MAX_COMPLETION_TOKENS_PREANALISI = tokenCap(
  'OPENAI_MAX_COMPLETION_TOKENS_PREANALYSIS',
  6_000
);
