/**
 * Italian AI Prompt Templates
 *
 * Italian language prompts for contract analysis.
 * These are the original Italian prompts extracted from lib/ai/analyze.ts.
 *
 * @module lib/ai/prompts/it
 */

import type { Policy } from '@/db/schema';
import type { Finding } from '../schemas';

/**
 * Build system prompt with company policies and perspective (Italian)
 */
export function buildSystemPrompt(policies: Policy[], perspective: 'cliente' | 'fornitore'): string {
  const policyList = policies
    .map((p) => `- **${p.name}** (${p.category || 'general'}): ${p.content}`)
    .join('\n');

  const perspectiveLabel = perspective === 'cliente' ? 'cliente (chi riceve il servizio/prodotto)' : 'fornitore (chi eroga il servizio/prodotto)';

  return `Sei un consulente contrattuale esperto. Analizzi contratti dal punto di vista del ${perspectiveLabel}.

PROSPETTIVA:
Valuta ogni clausola considerando vantaggi e rischi per il ${perspective}. Ciò che è vantaggioso per il cliente può essere svantaggioso per il fornitore e viceversa.

IL TUO COMPITO:
Identifica sia PUNTI DI FORZA (clausole vantaggiose) sia AREE DI MIGLIORAMENTO (clausole rischiose o migliorabili).

PUNTI DI FORZA (type: "strength"):
- Clausole che proteggono bene gli interessi del ${perspective}
- Termini favorevoli rispetto allo standard di mercato
- Garanzie e tutele ben formulate
- priority: null, redlineSuggestion: null

AREE DI MIGLIORAMENTO (type: "improvement"):
- Classifica con priorità:
  - "importante": Richiede attenzione prima della firma
  - "consigliato": Negoziazione raccomandata
  - "suggerimento": Miglioramento opzionale, accettabile se necessario

STILE:
- Titoli corti e diretti (es. "Termini di pagamento favorevoli", "Penale di recesso eccessiva")
- Spiegazioni concise: 1-2 frasi massimo, focalizzate sull'impatto pratico
- Linguaggio professionale, non allarmista
- NON inventare problemi: se non trovi nulla di rilevante, restituisci array vuoto

POLICY AZIENDALI:
${policyList}`;
}

/**
 * Build user prompt for chunk analysis (Italian)
 */
export function buildUserPrompt(chunkText: string, chunkIndex: number, perspective: 'cliente' | 'fornitore'): string {
  return `Analizza il seguente estratto contrattuale (chunk ${chunkIndex + 1}) dal punto di vista del ${perspective}.

---
${chunkText}
---

Identifica punti di forza E aree di miglioramento rispetto alle policy aziendali.
Per ogni elemento fornisci: titolo breve, tipo, policy di riferimento, priorità (null per punti di forza), spiegazione concisa, e suggerimento di modifica (null per punti di forza).
Se non trovi nulla di rilevante in questo chunk, restituisci findings: [].`;
}

/**
 * Build system prompt for executive summary generation (Italian)
 */
export function buildSummarySystemPrompt(perspective: 'cliente' | 'fornitore'): string {
  return `Sei un consulente contrattuale che sintetizza analisi in italiano. Stai valutando dal punto di vista del ${perspective === 'cliente' ? 'cliente' : 'fornitore'}.`;
}

/**
 * Build prompt for executive summary generation (Italian)
 */
export function buildSummaryPrompt(findings: Finding[], contractName: string, perspective: 'cliente' | 'fornitore'): string {
  const strengths = findings.filter((f) => f.type === 'strength');
  const improvements = findings.filter((f) => f.type === 'improvement');

  const strengthsSummary = strengths.length > 0
    ? strengths.map((f) => `- ${f.title}: ${f.explanation.slice(0, 80)}...`).join('\n')
    : 'Nessun punto di forza specifico identificato.';

  const improvementsSummary = improvements.length > 0
    ? improvements.map((f) => `- [${f.priority}] ${f.title}: ${f.explanation.slice(0, 80)}...`).join('\n')
    : 'Nessuna area di miglioramento identificata.';

  const importanteCount = improvements.filter((f) => f.priority === 'importante').length;
  const consigliatoCount = improvements.filter((f) => f.priority === 'consigliato').length;
  const suggerimentoCount = improvements.filter((f) => f.priority === 'suggerimento').length;

  return `Genera un riepilogo esecutivo per l'analisi del contratto "${contractName}" dal punto di vista del ${perspective}.

PUNTI DI FORZA (${strengths.length}):
${strengthsSummary}

AREE DI MIGLIORAMENTO (${improvements.length}):
${improvementsSummary}

Conteggio priorità miglioramenti:
- Importanti: ${importanteCount}
- Consigliati: ${consigliatoCount}
- Suggerimenti: ${suggerimentoCount}

Genera:
1. Un summary di 2-3 frasi bilanciato (menziona sia aspetti positivi che aree di miglioramento)
2. Valutazione complessiva: "positivo" (contratto solido), "equilibrato" (buono ma migliorabile), "da_rivedere" (necessita modifiche importanti)
3. Una raccomandazione concisa e professionale`;
}
