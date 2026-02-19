/**
 * Unit tests for contract chunking utilities
 *
 * @module lib/ai/__tests__/chunker.test
 */

import { describe, it, expect } from 'vitest';
import { chunkContract, estimatePages } from '@/lib/ai/chunker';

describe('Contract Chunker', () => {
  describe('chunkContract', () => {
    it('should return single chunk for short text', () => {
      const shortText = 'Il presente contratto regola i termini e le condizioni.';
      const result = chunkContract(shortText);

      expect(result.totalChunks).toBe(1);
      expect(result.requiresChunking).toBe(false);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0]?.text).toBe(shortText);
      expect(result.chunks[0]?.index).toBe(0);
      expect(result.chunks[0]?.startChar).toBe(0);
      expect(result.chunks[0]?.endChar).toBe(shortText.length);
    });

    it('should split long text into multiple chunks', () => {
      // Create text > 3000 tokens (~12000 characters)
      const paragraph = 'Paragrafo di esempio che contiene un lungo testo legale. '.repeat(50);
      const longText = (paragraph + '\n\n').repeat(100); // ~29000 chars

      const result = chunkContract(longText);

      expect(result.requiresChunking).toBe(true);
      expect(result.totalChunks).toBeGreaterThan(1);
      expect(result.chunks.length).toBe(result.totalChunks);
    });

    it('should preserve paragraph boundaries', () => {
      const para1 = 'Primo paragrafo.';
      const para2 = 'Secondo paragrafo.';
      const para3 = 'Terzo paragrafo.';
      const text = `${para1}\n\n${para2}\n\n${para3}`;

      const result = chunkContract(text);

      // For short text, should be single chunk
      expect(result.totalChunks).toBe(1);
      expect(result.chunks[0]?.text).toContain(para1);
      expect(result.chunks[0]?.text).toContain(para2);
      expect(result.chunks[0]?.text).toContain(para3);
    });

    it('should maintain overlap between chunks', () => {
      // Create text that forces 3 chunks with overlap
      const paragraph = 'P'.repeat(3000) + '. '; // ~3000 chars per paragraph
      const text = paragraph + '\n\n' + paragraph + '\n\n' + paragraph + '\n\n' + paragraph;

      const result = chunkContract(text, 3500); // Low token limit to force chunking

      if (result.totalChunks > 1) {
        // Check that chunks overlap (last paragraph of chunk N appears in chunk N+1)
        const lastLineChunk0 = result.chunks[0]?.text.split('\n\n').at(-1);
        const firstLineChunk1 = result.chunks[1]?.text.split('\n\n')[0];

        expect(lastLineChunk0).toBeTruthy();
        expect(firstLineChunk1).toBeTruthy();
        // They should be the same (overlap)
        expect(firstLineChunk1).toContain(lastLineChunk0!.substring(0, 100));
      }
    });

    it('should handle empty text', () => {
      const result = chunkContract('');

      expect(result.totalChunks).toBe(1);
      expect(result.requiresChunking).toBe(false);
      expect(result.chunks[0]?.text).toBe('');
    });

    it('should set correct chunk metadata', () => {
      const text = 'Test contract text.';
      const result = chunkContract(text);

      const chunk = result.chunks[0];
      expect(chunk).toBeDefined();
      expect(chunk?.index).toBe(0);
      expect(chunk?.startChar).toBe(0);
      expect(chunk?.endChar).toBeGreaterThan(0);
      expect(chunk?.pageEstimate).toBeGreaterThan(0);
      expect(chunk?.tokenEstimate).toBeGreaterThan(0);
    });

    it('should respect custom maxTokensPerChunk', () => {
      const paragraph = 'X'.repeat(1000) + '. '; // ~1000 chars
      const text = (paragraph + '\n\n').repeat(10); // ~10000 chars

      const resultLargeLimit = chunkContract(text, 10000);
      const resultSmallLimit = chunkContract(text, 1000);

      expect(resultLargeLimit.totalChunks).toBeLessThan(resultSmallLimit.totalChunks);
    });

    it('should number chunks sequentially', () => {
      const paragraph = 'P'.repeat(3000) + '. ';
      const text = (paragraph + '\n\n').repeat(5);

      const result = chunkContract(text, 3500);

      result.chunks.forEach((chunk, idx) => {
        expect(chunk.index).toBe(idx);
      });
    });
  });

  describe('estimatePages', () => {
    it('should estimate 1 page for short text', () => {
      const shortText = 'A'.repeat(1000);
      expect(estimatePages(shortText)).toBe(1);
    });

    it('should estimate multiple pages for long text', () => {
      const longText = 'A'.repeat(10000); // ~3.3 pages
      expect(estimatePages(longText)).toBe(4); // Rounds up
    });

    it('should use ~3000 chars per page', () => {
      const text3000 = 'A'.repeat(3000);
      const text6000 = 'A'.repeat(6000);
      const text9000 = 'A'.repeat(9000);

      expect(estimatePages(text3000)).toBe(1);
      expect(estimatePages(text6000)).toBe(2);
      expect(estimatePages(text9000)).toBe(3);
    });

    it('should round up partial pages', () => {
      const text = 'A'.repeat(3001); // Just over 1 page
      expect(estimatePages(text)).toBe(2);
    });

    it('should handle empty text', () => {
      expect(estimatePages('')).toBe(0);
    });
  });
});
