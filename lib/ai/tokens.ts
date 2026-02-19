/**
 * Token Estimation Utilities for Contract Chunking
 *
 * Provides token estimation for Italian text and context window management.
 * GPT tokenizer uses ~4 characters per token for Italian text on average.
 *
 * @module lib/ai/tokens
 */

/**
 * Estimate token count for Italian text
 *
 * Uses a simplified estimation of ~4 characters per token,
 * which is reasonably accurate for Italian legal text.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count (rounded up)
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens('Il presente contratto regola...');
 * console.log(tokens); // ~8 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if text fits within context window
 *
 * GPT-4o-mini has a 128K context window. We use 100K as the
 * safe limit to leave room for system prompts and output.
 *
 * @param text - Text to check
 * @param maxTokens - Maximum tokens allowed (default: 100,000)
 * @returns True if text fits in context window
 *
 * @example
 * ```typescript
 * if (fitsInContext(contractText)) {
 *   // Analyze in one pass
 * } else {
 *   // Need chunking
 * }
 * ```
 */
export function fitsInContext(text: string, maxTokens = 100000): boolean {
  return estimateTokens(text) <= maxTokens;
}

/**
 * Configuration constants for contract chunking
 *
 * These values are tuned for GPT-4o-mini and Italian legal contracts:
 * - MAX_CHUNK_TOKENS: Leaves room for system prompt (~2K) and output (~1K)
 * - OVERLAP_PARAGRAPHS: Maintains context between chunks
 * - POLICY_TOKENS_ESTIMATE: Reserved space for company policies in prompt
 */
export const CHUNK_CONFIG = {
  /** Maximum tokens per chunk (leaves space for system prompt and output) */
  MAX_CHUNK_TOKENS: 3000,
  /** Number of paragraphs to overlap between chunks for context */
  OVERLAP_PARAGRAPHS: 1,
  /** Estimated tokens reserved for policies in system prompt */
  POLICY_TOKENS_ESTIMATE: 2000,
} as const;
