/**
 * Finding Deduplication Utilities
 *
 * When analyzing overlapping chunks, the same finding may appear
 * in multiple chunks. This module provides deduplication using
 * text similarity (Jaccard index) and severity-based sorting.
 *
 * @module lib/ai/deduplicate
 */

import type { Finding } from './schemas';

/**
 * Calculate text similarity using Jaccard index
 *
 * Computes the ratio of shared words to total unique words.
 * Simple but effective for detecting similar clause texts.
 *
 * @param a - First text string
 * @param b - Second text string
 * @returns Similarity score from 0 (no overlap) to 1 (identical)
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  // Avoid division by zero for empty texts
  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Remove duplicate findings from overlapping chunks
 *
 * When chunking with overlap, the same problematic clause may
 * appear in adjacent chunks. This function removes duplicates
 * by comparing clauseText similarity.
 *
 * Two findings are considered duplicates if their clauseText
 * has >80% similarity (Jaccard index).
 *
 * @param findings - Array of findings from all chunks
 * @returns Deduplicated findings array (preserves first occurrence)
 *
 * @example
 * ```typescript
 * const allFindings = [...chunk1.findings, ...chunk2.findings];
 * const unique = deduplicateFindings(allFindings);
 * console.log(`Removed ${allFindings.length - unique.length} duplicates`);
 * ```
 */
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const unique: Finding[] = [];

  for (const finding of findings) {
    const isDuplicate = unique.some(
      (existing) => textSimilarity(existing.clauseText, finding.clauseText) > 0.8
    );

    if (!isDuplicate) {
      unique.push(finding);
    }
  }

  return unique;
}

/**
 * Sort findings: improvements first (by priority), then strengths
 */
export function sortFindings(findings: Finding[]): Finding[] {
  const typeOrder: Record<string, number> = { improvement: 0, strength: 1 };
  const priorityOrder: Record<string, number> = { importante: 0, consigliato: 1, suggerimento: 2 };

  return [...findings].sort((a, b) => {
    const ta = typeOrder[a.type] ?? 1;
    const tb = typeOrder[b.type] ?? 1;
    if (ta !== tb) return ta - tb;

    if (a.type === 'improvement' && b.type === 'improvement') {
      const pa = a.priority ? (priorityOrder[a.priority] ?? 99) : 99;
      const pb = b.priority ? (priorityOrder[b.priority] ?? 99) : 99;
      return pa - pb;
    }

    return 0;
  });
}
