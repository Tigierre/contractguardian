/**
 * Upstream Contract-Text Deduplication (CPERF-5)
 *
 * When several files are merged into one contract (contract + annexes, or a
 * contract split across versions), large portions are usually identical
 * boilerplate (headers, standard clauses, signature blocks). Today that
 * repeated text gets chunked and re-analyzed at full LLM cost on every copy.
 *
 * This module removes repeated blocks *before* chunking, attacking the root
 * cause of the "merge explosion": cost ∝ contract length × chunks. It works on
 * the already-extracted text, is purely deterministic and LLM-free, and keeps
 * the first occurrence of each block (preserving the context of the file it
 * first appears in).
 *
 * @module lib/ai/text-dedup
 */

import { textSimilarity } from './deduplicate';

/** Blocks shorter than this skip the (more expensive) near-dedup pass. */
const MIN_BLOCK_LEN_FOR_NEAR = 40;

/** Jaccard threshold above which two substantial blocks are "the same". */
const NEAR_DEDUP_SIMILARITY = 0.9;

/**
 * Cap on kept blocks compared during near-dedup. Beyond this only exact
 * (normalized) dedup runs — keeps the pass from degrading to O(n²) on very
 * large merges. Exact dedup alone already catches the dominant case
 * (byte-identical boilerplate), regardless of position.
 */
const NEAR_DEDUP_MAX_BLOCKS = 1500;

/** A single source document to fold into the merged text. */
export interface DedupeSource {
  filename: string;
  text: string;
}

/** Outcome of {@link dedupeContractText}. */
export interface DedupeResult {
  /** Merged text with per-file separators, repeated blocks removed. */
  combinedText: string;
  /** Total characters across all source texts (before dedup). */
  originalChars: number;
  /** Characters of the merged, deduplicated text. */
  dedupedChars: number;
  /** Number of repeated blocks dropped. */
  removedBlocks: number;
}

/** Normalize a block for exact-match comparison (case/whitespace-insensitive). */
function normalizeKey(block: string): string {
  return block.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Merge several contract texts into one, dropping repeated blocks.
 *
 * Two-tier dedup: an O(n) exact pass on a normalized key catches identical
 * boilerplate (the common case), and a bounded near-dedup pass (Jaccard)
 * catches lightly reworded repeats among substantial blocks. File separators
 * (`--- filename ---`) are always preserved and never deduplicated.
 *
 * @param sources - Source documents in the desired order
 * @returns The merged text plus dedup statistics
 */
export function dedupeContractText(sources: DedupeSource[]): DedupeResult {
  const seenExact = new Set<string>();
  const keptBlocks: string[] = [];
  const out: string[] = [];
  let removedBlocks = 0;
  let originalChars = 0;

  for (const src of sources) {
    originalChars += src.text.length;
    out.push(`--- ${src.filename} ---`);

    const blocks = src.text
      .split(/\n\n+/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    for (const block of blocks) {
      const key = normalizeKey(block);
      if (key.length === 0) continue;

      if (seenExact.has(key)) {
        removedBlocks++;
        continue;
      }

      const runNearDedup =
        block.length >= MIN_BLOCK_LEN_FOR_NEAR &&
        keptBlocks.length <= NEAR_DEDUP_MAX_BLOCKS;

      if (runNearDedup && keptBlocks.some((k) => textSimilarity(k, block) > NEAR_DEDUP_SIMILARITY)) {
        removedBlocks++;
        continue;
      }

      seenExact.add(key);
      if (block.length >= MIN_BLOCK_LEN_FOR_NEAR) keptBlocks.push(block);
      out.push(block);
    }
  }

  const combinedText = out.join('\n\n').trim();
  return {
    combinedText,
    originalChars,
    dedupedChars: combinedText.length,
    removedBlocks,
  };
}
