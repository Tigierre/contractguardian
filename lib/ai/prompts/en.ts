/**
 * English AI Prompt Templates
 *
 * English language prompts for contract analysis.
 * Note: Field values (type, priority) remain as Italian enum identifiers for database consistency.
 *
 * @module lib/ai/prompts/en
 */

import type { Policy } from '@/db/schema';
import type { Finding } from '../schemas';

/**
 * Build system prompt with company policies and perspective (English)
 */
export function buildSystemPrompt(policies: Policy[], perspective: 'cliente' | 'fornitore'): string {
  const policyList = policies
    .map((p) => `- **${p.name}** (${p.category || 'general'}): ${p.content}`)
    .join('\n');

  const perspectiveLabel = perspective === 'cliente' ? 'client (service/product recipient)' : 'supplier (service/product provider)';
  const perspectiveTerm = perspective === 'cliente' ? 'client' : 'supplier';

  return `You are an expert contract consultant. You analyze contracts from the ${perspectiveLabel} perspective.

PERSPECTIVE:
Evaluate each clause considering advantages and risks for the ${perspectiveTerm}. What benefits the client may disadvantage the supplier and vice versa.

YOUR TASK:
Identify both STRENGTHS (advantageous clauses) and AREAS FOR IMPROVEMENT (risky or improvable clauses).

STRENGTHS (type: "strength"):
- Clauses that well protect the ${perspectiveTerm}'s interests
- Terms favorable compared to market standard
- Well-formulated guarantees and protections
- priority: null, redlineSuggestion: null

AREAS FOR IMPROVEMENT (type: "improvement"):
- Classify by priority (use these exact Italian values):
  - "importante": Requires attention before signing
  - "consigliato": Negotiation recommended
  - "suggerimento": Optional improvement, acceptable if necessary

STYLE:
- Short, direct titles (e.g., "Favorable payment terms", "Excessive termination penalty")
- Concise explanations: 1-2 sentences max, focused on practical impact
- Professional language, not alarmist
- Do NOT invent problems: if nothing relevant, return empty array

IMPORTANT: Use the exact Italian enum values for type ("strength", "improvement") and priority ("importante", "consigliato", "suggerimento"). These are database identifiers, not display strings.

COMPANY POLICIES:
${policyList}`;
}

/**
 * Build user prompt for chunk analysis (English)
 */
export function buildUserPrompt(chunkText: string, chunkIndex: number, perspective: 'cliente' | 'fornitore'): string {
  const perspectiveTerm = perspective === 'cliente' ? 'client' : 'supplier';

  return `Analyze the following contract excerpt (chunk ${chunkIndex + 1}) from the ${perspectiveTerm} perspective.

---
${chunkText}
---

Identify strengths AND areas for improvement relative to company policies.
For each element provide: brief title, type, referenced policy, priority (null for strengths), concise explanation, and modification suggestion (null for strengths).
If nothing relevant in this chunk, return findings: [].

REMEMBER: Use Italian enum values for priority ("importante", "consigliato", "suggerimento") and type ("strength", "improvement").`;
}

/**
 * Build system prompt for executive summary generation (English)
 */
export function buildSummarySystemPrompt(perspective: 'cliente' | 'fornitore'): string {
  const perspectiveTerm = perspective === 'cliente' ? 'client' : 'supplier';
  return `You are a contract consultant who synthesizes analyses in English. You are evaluating from the ${perspectiveTerm} perspective.`;
}

/**
 * Build prompt for executive summary generation (English)
 */
export function buildSummaryPrompt(findings: Finding[], contractName: string, perspective: 'cliente' | 'fornitore'): string {
  const strengths = findings.filter((f) => f.type === 'strength');
  const improvements = findings.filter((f) => f.type === 'improvement');

  const strengthsSummary = strengths.length > 0
    ? strengths.map((f) => `- ${f.title}: ${f.explanation.slice(0, 80)}...`).join('\n')
    : 'No specific strengths identified.';

  const improvementsSummary = improvements.length > 0
    ? improvements.map((f) => `- [${f.priority}] ${f.title}: ${f.explanation.slice(0, 80)}...`).join('\n')
    : 'No areas for improvement identified.';

  const importanteCount = improvements.filter((f) => f.priority === 'importante').length;
  const consigliatoCount = improvements.filter((f) => f.priority === 'consigliato').length;
  const suggerimentoCount = improvements.filter((f) => f.priority === 'suggerimento').length;

  const perspectiveTerm = perspective === 'cliente' ? 'client' : 'supplier';

  return `Generate an executive summary for the analysis of contract "${contractName}" from the ${perspectiveTerm} perspective.

STRENGTHS (${strengths.length}):
${strengthsSummary}

AREAS FOR IMPROVEMENT (${improvements.length}):
${improvementsSummary}

Priority count for improvements:
- Important: ${importanteCount}
- Recommended: ${consigliatoCount}
- Suggestions: ${suggerimentoCount}

Generate:
1. A balanced 2-3 sentence summary (mention both positive aspects and areas for improvement)
2. Overall assessment: "positivo" (solid contract), "equilibrato" (good but improvable), "da_rivedere" (requires important changes)
3. A concise and professional recommendation

IMPORTANT: For the overall assessment, use the exact Italian enum values: "positivo", "equilibrato", or "da_rivedere".`;
}
