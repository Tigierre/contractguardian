/**
 * English Enhanced AI Prompt Templates
 *
 * Enhanced prompts for contract analysis with validated metadata.
 * Includes actor assignment and legal norm citations.
 *
 * @module lib/ai/prompts/en-enhanced
 */

import type { Policy } from '@/db/schema';
import type { LegalNorm } from '@/lib/legal-norms/query';

/**
 * Build enhanced system prompt with company policies, party names, and legal norms (English)
 */
export function buildEnhancedSystemPrompt(
  policies: Policy[],
  partyA: string | null,
  partyB: string | null,
  norms: LegalNorm[]
): string {
  const policyList = policies
    .map((p) => `- **${p.name}** (${p.category || 'general'}): ${p.content}`)
    .join('\n');

  const partyALabel = partyA || 'First party';
  const partyBLabel = partyB || 'Second party';

  const normsSection = norms.length > 0
    ? `\n\nAPPLICABLE LEGAL NORMS:\n${norms.map(n => `- [${n.normId}] ${n.citation}: ${n.title}`).join('\n')}`
    : '';

  return `You are an expert contract consultant. You analyze the contract between Party A (${partyALabel}) and Party B (${partyBLabel}).

PERSPECTIVE:
Evaluate each clause considering advantages and risks for both parties.

YOUR TASK:
Identify both STRENGTHS (advantageous clauses) and AREAS FOR IMPROVEMENT (risky or improvable clauses).

STRENGTHS (type: "strength"):
- Clauses that well protect the interests of one or both parties
- Terms favorable compared to market standard
- Well-formulated guarantees and protections
- priority: null, redlineSuggestion: null

AREAS FOR IMPROVEMENT (type: "improvement"):
- Classify by priority (use these exact Italian values):
  - "importante": Requires attention before signing
  - "consigliato": Negotiation recommended
  - "suggerimento": Optional improvement, acceptable if necessary

ACTOR ASSIGNMENT:
For each finding, indicate which party is primarily involved:
- "partyA": the risk or benefit primarily concerns ${partyALabel}
- "partyB": the risk or benefit primarily concerns ${partyBLabel}
- "general": concerns both parties or neither specifically

NORM CITATION:
If a risk or strength is connected to a specific norm from the list above, include the normId in the normIds field.
Use ONLY normIds present in the list. If no norm applies, leave the array empty.
${normsSection}

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
 * Build enhanced user prompt for chunk analysis (English)
 */
export function buildEnhancedUserPrompt(
  chunkText: string,
  chunkIndex: number,
  partyA: string | null,
  partyB: string | null
): string {
  const partyALabel = partyA || 'Party A';
  const partyBLabel = partyB || 'Party B';

  return `Analyze the following contract excerpt (chunk ${chunkIndex + 1}).

---
${chunkText}
---

Identify strengths AND areas for improvement relative to company policies.
Identify specifically the risks for ${partyALabel} and for ${partyBLabel} separately.

For each element provide:
- brief title
- type ("strength" or "improvement")
- referenced policy
- priority (null for strengths, Italian values "importante"/"consigliato"/"suggerimento" for improvements)
- concise explanation
- modification suggestion (null for strengths)
- actor ("partyA", "partyB", or "general")
- normIds (array of norm IDs from the list, empty if no norm applies)

If nothing relevant in this chunk, return findings: [].`;
}
