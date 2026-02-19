/**
 * Enhanced Contract Analysis Functions
 *
 * Enhanced AI analysis with actor assignment and legal norm citations.
 * Uses validated metadata (parties, contract type, jurisdiction) for context.
 *
 * @module lib/ai/enhanced-analyze
 */

import { zodResponseFormat } from 'openai/helpers/zod';
import { openai } from './client';
import {
  EnhancedChunkAnalysisSchema,
  ExecutiveSummarySchema,
  type EnhancedChunkAnalysis,
  type EnhancedFinding,
  type ExecutiveSummary,
} from './schemas';
import { withRetry, AIError, AI_ERROR_CODES, AI_ERROR_MESSAGES } from './retry';
import type { Policy } from '@/db/schema';
import { queryNormsByTypeAndJurisdiction, type LegalNorm, type Jurisdiction } from '@/lib/legal-norms/query';
import type { ContractTypeId } from '@/lib/taxonomies/contract-types';
import * as itEnhancedPrompts from './prompts/it-enhanced';
import * as enEnhancedPrompts from './prompts/en-enhanced';

const MODEL = 'gpt-4o-mini';

/**
 * Validated metadata for enhanced analysis
 */
export interface ValidatedMetadata {
  partyA: string | null;
  partyB: string | null;
  contractType: ContractTypeId;
  jurisdiction: Jurisdiction | 'unknown';
}

/**
 * Analyze a single chunk with enhanced context (actor + legal norms)
 */
export async function analyzeChunkEnhanced(
  chunkText: string,
  policies: Policy[],
  chunkIndex: number,
  validatedMetadata: ValidatedMetadata,
  language: 'it' | 'en' = 'it'
): Promise<EnhancedChunkAnalysis> {
  const prompts = language === 'en' ? enEnhancedPrompts : itEnhancedPrompts;

  // Query relevant legal norms only if jurisdiction is known
  let relevantNorms: LegalNorm[] = [];
  if (validatedMetadata.jurisdiction !== 'unknown') {
    const allRelevantNorms = queryNormsByTypeAndJurisdiction(
      validatedMetadata.contractType,
      validatedMetadata.jurisdiction,
      0.7 // minimum relevance threshold
    );
    // Limit to top 10 to avoid token overflow
    relevantNorms = allRelevantNorms.slice(0, 10);
  }

  const systemPrompt = prompts.buildEnhancedSystemPrompt(
    policies,
    validatedMetadata.partyA,
    validatedMetadata.partyB,
    relevantNorms
  );

  const userPrompt = prompts.buildEnhancedUserPrompt(
    chunkText,
    chunkIndex,
    validatedMetadata.partyA,
    validatedMetadata.partyB
  );

  return withRetry(async () => {
    const response = await openai.chat.completions.parse({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(EnhancedChunkAnalysisSchema, 'enhanced_analysis'),
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
 * Generate enhanced executive summary with party names
 */
export async function generateEnhancedExecutiveSummary(
  findings: EnhancedFinding[],
  contractName: string,
  partyA: string | null,
  partyB: string | null,
  language: 'it' | 'en' = 'it'
): Promise<ExecutiveSummary> {
  const partyALabel = partyA || (language === 'it' ? 'Prima parte' : 'First party');
  const partyBLabel = partyB || (language === 'it' ? 'Seconda parte' : 'Second party');

  const strengths = findings.filter((f) => f.type === 'strength');
  const improvements = findings.filter((f) => f.type === 'improvement');

  const strengthsSummary = strengths.length > 0
    ? strengths.map((f) => `- ${f.title} (${f.actor}): ${f.explanation.slice(0, 80)}...`).join('\n')
    : (language === 'it' ? 'Nessun punto di forza specifico identificato.' : 'No specific strengths identified.');

  const improvementsSummary = improvements.length > 0
    ? improvements.map((f) => `- [${f.priority}] (${f.actor}) ${f.title}: ${f.explanation.slice(0, 80)}...`).join('\n')
    : (language === 'it' ? 'Nessuna area di miglioramento identificata.' : 'No areas for improvement identified.');

  const importanteCount = improvements.filter((f) => f.priority === 'importante').length;
  const consigliatoCount = improvements.filter((f) => f.priority === 'consigliato').length;
  const suggerimentoCount = improvements.filter((f) => f.priority === 'suggerimento').length;

  const summaryPrompt = language === 'it'
    ? `Genera un riepilogo esecutivo per l'analisi del contratto "${contractName}" tra ${partyALabel} e ${partyBLabel}.

PUNTI DI FORZA (${strengths.length}):
${strengthsSummary}

AREE DI MIGLIORAMENTO (${improvements.length}):
${improvementsSummary}

Conteggio priorità miglioramenti:
- Importanti: ${importanteCount}
- Consigliati: ${consigliatoCount}
- Suggerimenti: ${suggerimentoCount}

Genera:
1. Un summary di 2-3 frasi bilanciato che menzioni entrambe le parti (${partyALabel} e ${partyBLabel})
2. Valutazione complessiva: "positivo" (contratto solido), "equilibrato" (buono ma migliorabile), "da_rivedere" (necessita modifiche importanti)
3. Una raccomandazione concisa e professionale`
    : `Generate an executive summary for the analysis of contract "${contractName}" between ${partyALabel} and ${partyBLabel}.

STRENGTHS (${strengths.length}):
${strengthsSummary}

AREAS FOR IMPROVEMENT (${improvements.length}):
${improvementsSummary}

Priority count for improvements:
- Important: ${importanteCount}
- Recommended: ${consigliatoCount}
- Suggestions: ${suggerimentoCount}

Generate:
1. A balanced 2-3 sentence summary that mentions both parties (${partyALabel} and ${partyBLabel})
2. Overall assessment: "positivo" (solid contract), "equilibrato" (good but improvable), "da_rivedere" (requires important changes)
3. A concise and professional recommendation`;

  const systemPromptText = language === 'it'
    ? `Sei un consulente contrattuale che sintetizza analisi in italiano. Stai valutando il contratto tra ${partyALabel} e ${partyBLabel}.`
    : `You are a contract consultant who synthesizes analyses in English. You are evaluating the contract between ${partyALabel} and ${partyBLabel}.`;

  return withRetry(async () => {
    const response = await openai.chat.completions.parse({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPromptText },
        { role: 'user', content: summaryPrompt },
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
