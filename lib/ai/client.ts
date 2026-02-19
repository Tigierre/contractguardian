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
 * Uses GPT-4o-mini by default for cost-effective contract analysis.
 * The client is shared across the application to manage rate limits
 * and connection pooling efficiently.
 *
 * @example
 * ```typescript
 * import { openai } from '@/lib/ai/client';
 *
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4o-mini',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, ''),
});
