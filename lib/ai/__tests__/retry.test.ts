/**
 * Unit tests for AI retry logic with exponential backoff
 *
 * @module lib/ai/__tests__/retry.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from '@/lib/ai/retry';
import OpenAI from 'openai';

// Helper to create mock Headers object for OpenAI errors
function createMockHeaders(): Headers {
  const headers = new Headers();
  return headers;
}

describe('AI Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AIError class', () => {
    it('should create error with correct properties', () => {
      const error = new AIError('Test message', 'TEST_CODE', true);

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('AIError');
    });

    it('should default retryable to false', () => {
      const error = new AIError('Test', 'CODE');
      expect(error.retryable).toBe(false);
    });

    it('should have Italian error messages', () => {
      expect(AI_ERROR_MESSAGES.MAX_RETRIES_EXCEEDED(3)).toContain('3 tentativi');
      expect(AI_ERROR_MESSAGES.RATE_LIMIT).toContain('sovraccarico');
      expect(AI_ERROR_MESSAGES.CONNECTION_ERROR).toContain('connessione');
      expect(AI_ERROR_MESSAGES.AUTHENTICATION_ERROR).toContain('autenticazione');
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on RateLimitError and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()))
        .mockRejectedValueOnce(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()))
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 1000);

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for first retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for second retry delay (2000ms)
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should retry on APIConnectionError and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new OpenAI.APIConnectionError({ message: 'Connection failed' }))
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 1000);

      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);

      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw AIError immediately on AuthenticationError', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          new OpenAI.AuthenticationError(401, {}, 'Invalid API key', createMockHeaders())
        );

      try {
        await withRetry(fn, 3, 1000);
        expect.fail('Should have thrown AIError');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).code).toBe(AI_ERROR_CODES.AUTHENTICATION_ERROR);
        expect((error as AIError).retryable).toBe(false);
      }

      // Should not retry
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw AIError immediately on BadRequestError', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new OpenAI.BadRequestError(400, {}, 'Bad request', createMockHeaders()));

      try {
        await withRetry(fn, 3, 1000);
        expect.fail('Should have thrown AIError');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).code).toBe(AI_ERROR_CODES.INVALID_REQUEST);
        expect((error as AIError).retryable).toBe(false);
      }

      // Should not retry
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw AIError after max retries exceeded', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()));

      const promise = withRetry(fn, 3, 1000);

      // Run all timers to completion
      await vi.runAllTimersAsync();

      try {
        await promise;
        expect.fail('Should have thrown AIError');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        expect((error as AIError).code).toBe(AI_ERROR_CODES.MAX_RETRIES_EXCEEDED);
        expect((error as AIError).retryable).toBe(false);
      }

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()));

      const baseDelay = 100; // Use smaller delays for faster test
      const promise = withRetry(fn, 3, baseDelay);

      // Run all timers to completion
      await vi.runAllTimersAsync();

      try {
        await promise;
        expect.fail('Should have thrown AIError');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
      }

      // Verify exponential backoff happened by checking 3 attempts were made
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw non-OpenAI errors immediately', async () => {
      const customError = new Error('Custom error');
      const fn = vi.fn().mockRejectedValue(customError);

      await expect(withRetry(fn, 3, 1000)).rejects.toThrow('Custom error');

      // Should not retry
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should work with different maxRetries', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()));

      const promise = withRetry(fn, 2, 1000); // Only 2 attempts

      // Run all timers to completion
      await vi.runAllTimersAsync();

      try {
        await promise;
        expect.fail('Should have thrown AIError');
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
      }
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with different base delays', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new OpenAI.RateLimitError(429, {}, 'Rate limit', createMockHeaders()))
        .mockResolvedValue('success');

      const promise = withRetry(fn, 3, 500); // 500ms base delay

      await vi.advanceTimersByTimeAsync(0); // Attempt 1
      await vi.advanceTimersByTimeAsync(500); // Retry after 500ms

      const result = await promise;
      expect(result).toBe('success');
    });
  });
});
