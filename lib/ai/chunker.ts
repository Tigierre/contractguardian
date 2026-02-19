/**
 * Contract Chunking Library
 *
 * Divides long contracts into semantic chunks that respect
 * GPT-4o-mini's context window limits while preserving context
 * through paragraph overlap.
 *
 * @module lib/ai/chunker
 */

import { estimateTokens, CHUNK_CONFIG } from './tokens';

/**
 * A single chunk of contract text
 *
 * Contains the text along with positional metadata
 * for mapping findings back to the original document.
 */
export interface Chunk {
  /** The chunk text content */
  text: string;
  /** Zero-based chunk index */
  index: number;
  /** Starting character index in original document */
  startChar: number;
  /** Ending character index in original document */
  endChar: number;
  /** Estimated page number (for UI display) */
  pageEstimate: number;
  /** Estimated token count */
  tokenEstimate: number;
}

/**
 * Result of chunking a contract
 *
 * Contains the chunks array plus metadata about
 * whether chunking was necessary.
 */
export interface ChunkingResult {
  /** Array of contract chunks */
  chunks: Chunk[];
  /** Total number of chunks */
  totalChunks: number;
  /** True if the contract was split (false if single chunk) */
  requiresChunking: boolean;
}

/**
 * Split contract text into semantic chunks
 *
 * Divides contract text into chunks based on paragraphs,
 * maintaining overlap between chunks to preserve context
 * for the AI model. Chunks respect the configured token limit.
 *
 * Strategy:
 * 1. If text fits in one chunk, return as single chunk
 * 2. Otherwise, split by paragraphs and group until limit
 * 3. Maintain 1-paragraph overlap for context continuity
 *
 * @param text - Full contract text to chunk
 * @param maxTokensPerChunk - Max tokens per chunk (default from config)
 * @returns ChunkingResult with chunks array and metadata
 *
 * @example
 * ```typescript
 * const { chunks, requiresChunking } = chunkContract(longContractText);
 * if (requiresChunking) {
 *   console.log(`Split into ${chunks.length} chunks`);
 * }
 * ```
 */
export function chunkContract(
  text: string,
  maxTokensPerChunk = CHUNK_CONFIG.MAX_CHUNK_TOKENS
): ChunkingResult {
  const totalTokens = estimateTokens(text);

  // If entire text fits in one chunk, don't split
  if (totalTokens <= maxTokensPerChunk) {
    return {
      chunks: [
        {
          text: text.trim(),
          index: 0,
          startChar: 0,
          endChar: text.length,
          pageEstimate: 1,
          tokenEstimate: totalTokens,
        },
      ],
      totalChunks: 1,
      requiresChunking: false,
    };
  }

  const paragraphs = splitIntoParagraphs(text);
  const chunks: Chunk[] = [];

  let currentParagraphs: string[] = [];
  let currentTokens = 0;
  let charOffset = 0;
  let chunkStartChar = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // If adding this paragraph exceeds limit, save current chunk
    if (currentTokens + paraTokens > maxTokensPerChunk && currentParagraphs.length > 0) {
      // Save current chunk
      const chunkText = currentParagraphs.join('\n\n');
      chunks.push({
        text: chunkText,
        index: chunks.length,
        startChar: chunkStartChar,
        endChar: charOffset,
        pageEstimate: Math.ceil(charOffset / 3000),
        tokenEstimate: currentTokens,
      });

      // Overlap: keep last paragraph for context continuity
      const lastPara = currentParagraphs.at(-1);
      currentParagraphs = lastPara ? [lastPara] : [];
      currentTokens = lastPara ? estimateTokens(lastPara) : 0;
      chunkStartChar = charOffset - (lastPara?.length ?? 0);
    }

    currentParagraphs.push(para);
    currentTokens += paraTokens;
    charOffset += para.length + 2; // +2 for \n\n separator
  }

  // Save final chunk
  if (currentParagraphs.length > 0) {
    const chunkText = currentParagraphs.join('\n\n');
    chunks.push({
      text: chunkText,
      index: chunks.length,
      startChar: chunkStartChar,
      endChar: text.length,
      pageEstimate: Math.ceil(text.length / 3000),
      tokenEstimate: currentTokens,
    });
  }

  return {
    chunks,
    totalChunks: chunks.length,
    requiresChunking: true,
  };
}

/**
 * Split text into paragraphs
 *
 * Splits on double newlines and filters empty paragraphs.
 * Preserves whitespace trimming for cleaner chunks.
 *
 * @param text - Text to split
 * @returns Array of non-empty paragraph strings
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Estimate page count for contract text
 *
 * Uses ~3000 characters per A4 page as standard.
 * Useful for UI display and progress estimation.
 *
 * @param text - Contract text
 * @returns Estimated page count
 *
 * @example
 * ```typescript
 * const pages = estimatePages(contractText);
 * console.log(`Contract is ~${pages} pages`);
 * ```
 */
export function estimatePages(text: string): number {
  return Math.ceil(text.length / 3000);
}
