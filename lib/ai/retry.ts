/**
 * Retry Logic with Exponential Backoff
 *
 * Provides resilient API call handling for OpenAI integration.
 * Automatically retries on rate limits and connection errors,
 * with exponential backoff to respect API limits.
 *
 * @module lib/ai/retry
 */

import OpenAI from 'openai';

/**
 * AI-specific error class
 *
 * Extends Error with additional metadata for API error handling:
 * - code: Machine-readable error identifier
 * - retryable: Whether the operation can be retried
 */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Pre-defined AI error codes and messages (Italian)
 */
export const AI_ERROR_CODES = {
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  PARSE_ERROR: 'PARSE_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
} as const;

export const AI_ERROR_MESSAGES = {
  MAX_RETRIES_EXCEEDED: (retries: number) =>
    `Analisi fallita dopo ${retries} tentativi. Riprova tra qualche minuto.`,
  PARSE_ERROR: 'Risposta AI non valida. Riprova.',
  RATE_LIMIT: 'Servizio AI temporaneamente sovraccarico. Riprova tra qualche secondo.',
  CONNECTION_ERROR: 'Impossibile connettersi al servizio AI. Verifica la connessione.',
  AUTHENTICATION_ERROR: 'Errore di autenticazione con il servizio AI.',
  INVALID_REQUEST: 'Richiesta non valida per il servizio AI.',
} as const;

/**
 * Sleep utility for delay between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry on transient failures
 *
 * Implements exponential backoff strategy:
 * - Attempt 1: immediate
 * - Attempt 2: wait baseDelayMs (default 1s)
 * - Attempt 3: wait baseDelayMs * 2 (2s)
 * - Attempt 4: wait baseDelayMs * 4 (4s)
 *
 * Retryable errors:
 * - RateLimitError (429): API rate limit exceeded
 * - APIConnectionError: Network connectivity issues
 *
 * Non-retryable errors (thrown immediately):
 * - AuthenticationError: Invalid API key
 * - BadRequestError: Invalid request parameters
 * - Other OpenAI errors
 *
 * @param fn - Async function to execute
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay in milliseconds for backoff (default: 1000)
 * @returns Result of the function execution
 * @throws AIError on max retries exceeded or non-retryable error
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => openai.chat.completions.create({ ... }),
 *   3,
 *   1000
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Rate limit - retry with backoff
      if (error instanceof OpenAI.RateLimitError) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[AI] Rate limit hit (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      // Connection error - retry with backoff
      if (error instanceof OpenAI.APIConnectionError) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[AI] Connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      // Authentication error - not retryable
      if (error instanceof OpenAI.AuthenticationError) {
        throw new AIError(
          AI_ERROR_MESSAGES.AUTHENTICATION_ERROR,
          AI_ERROR_CODES.AUTHENTICATION_ERROR,
          false
        );
      }

      // Bad request - not retryable
      if (error instanceof OpenAI.BadRequestError) {
        throw new AIError(
          AI_ERROR_MESSAGES.INVALID_REQUEST,
          AI_ERROR_CODES.INVALID_REQUEST,
          false
        );
      }

      // Other OpenAI errors - not retryable
      throw error;
    }
  }

  // Max retries exceeded
  throw new AIError(
    AI_ERROR_MESSAGES.MAX_RETRIES_EXCEEDED(maxRetries),
    AI_ERROR_CODES.MAX_RETRIES_EXCEEDED,
    false
  );
}
