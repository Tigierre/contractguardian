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
