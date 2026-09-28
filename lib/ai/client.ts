/**
 * OpenAI Client Singleton
 *
 * Provides a single, configured OpenAI client instance for the application.
 * Environment variable validation is performed at import time to fail fast
 * during development/deployment if the API key is missing.
 *
 * @module lib/ai/client
 */

import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY non configurato');
}

/**
 * Configured OpenAI client instance
 *
 * The client is shared across the application to manage rate limits
 * and connection pooling efficiently. I modelli usati per l'analisi
 * sono definiti sotto (MODEL_PREANALISI, MODEL_ANALISI).
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, ''),
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
