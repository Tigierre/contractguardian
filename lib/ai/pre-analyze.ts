/**
 * Pre-Analysis Contract Metadata Extraction
 *
 * Extracts essential contract metadata (parties, type, jurisdiction)
 * from strategic text excerpts using GPT-4o-mini with structured outputs.
 *
 * @module lib/ai/pre-analyze
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { openai } from './client';
import {
  PreAnalysisSchema,
  type PreAnalysis,
  calculateOverallConfidence,
} from './schemas';
import { withRetry, AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from './retry';
import {
  buildPreAnalysisSystemPrompt as buildItSystemPrompt,
  buildPreAnalysisUserPrompt as buildItUserPrompt,
} from './prompts/it-pre-analysis';
import {
  buildPreAnalysisSystemPrompt as buildEnSystemPrompt,
  buildPreAnalysisUserPrompt as buildEnUserPrompt,
} from './prompts/en-pre-analysis';

const MODEL = 'gpt-4o-mini';

/**
 * Length of header excerpt (first N chars)
 */
const HEADER_LENGTH = 1500;

/**
 * Length of footer excerpt (last N chars)
 */
const FOOTER_LENGTH = 1500;

/**
 * Length of body sample from midpoint
 */
const BODY_SAMPLE_LENGTH = 500;

/**
 * Extract strategic excerpts from contract text for metadata extraction
 *
 * Extracts:
 * - Header (first HEADER_LENGTH chars) - contains parties, title
 * - Footer (last FOOTER_LENGTH chars) - contains jurisdiction clause
 * - Body sample (BODY_SAMPLE_LENGTH chars from midpoint) - context
 *
 * @param fullText - Complete contract text
 * @returns Formatted excerpts with section labels
 */
export function extractMetadataExcerpts(fullText: string): string {
  const textLength = fullText.length;

  // Edge case: if text is shorter than total excerpt length, return full text
  const totalExcerptLength = HEADER_LENGTH + FOOTER_LENGTH + BODY_SAMPLE_LENGTH;
  if (textLength <= totalExcerptLength) {
    return fullText;
  }

  // Extract header
  const header = fullText.slice(0, HEADER_LENGTH);

  // Extract footer
  const footer = fullText.slice(-FOOTER_LENGTH);

  // Extract body sample from midpoint
  const midpoint = Math.floor(textLength / 2);
  const bodyStart = Math.max(0, midpoint - Math.floor(BODY_SAMPLE_LENGTH / 2));
  const body = fullText.slice(bodyStart, bodyStart + BODY_SAMPLE_LENGTH);

  // Format as labeled sections
  return `[HEADER - First ${HEADER_LENGTH} chars]
${header}

[BODY SAMPLE - ${BODY_SAMPLE_LENGTH} chars from midpoint]
${body}

[FOOTER - Last ${FOOTER_LENGTH} chars]
${footer}`;
}

/**
 * Extract contract metadata using AI-powered analysis
 *
 * Sends strategic excerpts (header + body + footer) to GPT-4o-mini
 * to extract:
 * - Party A and Party B names with confidence levels
 * - Contract type (from taxonomy) with confidence
 * - Jurisdiction (italia/eu/usa/unknown) with confidence
 *
 * Uses structured outputs via Zod schema for type-safe results.
 *
 * @param contractText - Full contract text
 * @param language - Analysis language ('it' or 'en')
 * @returns Extracted metadata with confidence levels
 * @throws AIError on API failures or parsing errors
 */
export async function extractContractMetadata(
  contractText: string,
  language: 'it' | 'en' = 'it'
): Promise<PreAnalysis> {
  // Extract strategic excerpts
  const excerpts = extractMetadataExcerpts(contractText);

  // Select prompts based on language
  const systemPrompt =
    language === 'en' ? buildEnSystemPrompt() : buildItSystemPrompt();
  const userPrompt =
    language === 'en' ? buildEnUserPrompt(excerpts) : buildItUserPrompt(excerpts);

  // Call OpenAI with retry logic
  return withRetry(async () => {
    const response = await openai.chat.completions.parse({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(PreAnalysisSchema, 'pre_analysis'),
      temperature: 0.3,
    });

    // Check for refusal
    const refusal = response.choices[0]?.message?.refusal;
    if (refusal) {
      throw new AIError(
        `AI rifiutato analisi: ${refusal}`,
        AI_ERROR_CODES.INVALID_REQUEST,
        false
      );
    }

    // Get parsed result
    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new AIError(
        AI_ERROR_MESSAGES.PARSE_ERROR,
        AI_ERROR_CODES.PARSE_ERROR,
        true
      );
    }

    return parsed;
  });
}

/**
 * Re-export confidence calculation utility
 */
export { calculateOverallConfidence };
