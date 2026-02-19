/**
 * Contract Analysis Functions
 *
 * Core AI analysis logic for contract clause evaluation.
 * Uses OpenAI GPT-4o-mini with structured outputs via Zod schemas.
 *
 * @module lib/ai/analyze
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { openai } from './client';
import {
  ChunkAnalysisSchema,
  ExecutiveSummarySchema,
  type ChunkAnalysis,
  type ExecutiveSummary,
  type Finding,
} from './schemas';
import { withRetry, AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from './retry';
import type { Policy } from '@/db/schema';
import * as itPrompts from './prompts/it';
import * as enPrompts from './prompts/en';

const MODEL = 'gpt-4o-mini';

/**
 * Analyze a single chunk of contract text from a specific perspective
 */
export async function analyzeChunk(
  chunkText: string,
  policies: Policy[],
  chunkIndex: number,
  perspective: 'cliente' | 'fornitore',
  language: 'it' | 'en' = 'it'
): Promise<ChunkAnalysis> {
  const prompts = language === 'en' ? enPrompts : itPrompts;
  const systemPrompt = prompts.buildSystemPrompt(policies, perspective);
  const userPrompt = prompts.buildUserPrompt(chunkText, chunkIndex, perspective);

  return withRetry(async () => {
    const response = await openai.chat.completions.parse({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(ChunkAnalysisSchema, 'chunk_analysis'),
      temperature: 0.3,
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new AIError(AI_ERROR_MESSAGES.PARSE_ERROR, AI_ERROR_CODES.PARSE_ERROR, true);
    }

    return parsed;
  });
}

/**
 * Generate executive summary from analysis findings
 */
export async function generateExecutiveSummary(
  findings: Finding[],
  contractName: string,
  perspective: 'cliente' | 'fornitore',
  language: 'it' | 'en' = 'it'
): Promise<ExecutiveSummary> {
  const prompts = language === 'en' ? enPrompts : itPrompts;
  const systemPrompt = prompts.buildSummarySystemPrompt(perspective);
  const userPrompt = prompts.buildSummaryPrompt(findings, contractName, perspective);

  return withRetry(async () => {
    const response = await openai.chat.completions.parse({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(ExecutiveSummarySchema, 'executive_summary'),
      temperature: 0.3,
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new AIError(AI_ERROR_MESSAGES.PARSE_ERROR, AI_ERROR_CODES.PARSE_ERROR, true);
    }

    return parsed;
  });
}

