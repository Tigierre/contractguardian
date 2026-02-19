/**
 * Italian Enhanced AI Prompt Templates
 *
 * Enhanced prompts for contract analysis with validated metadata.
 * Includes actor assignment and legal norm citations.
 *
 * @module lib/ai/prompts/it-enhanced
 */

import type { Policy } from '@/db/schema';
import type { LegalNorm } from '@/lib/legal-norms/query';

/**
 * Build enhanced system prompt with company policies, party names, and legal norms (Italian)
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

  const partyALabel = partyA || 'Prima parte';
  const partyBLabel = partyB || 'Seconda parte';

  const normsSection = norms.length > 0
    ? `\n\nNORME LEGALI APPLICABILI:\n${norms.map(n => `- [${n.normId}] ${n.citation}: ${n.title}`).join('\n')}`
    : '';

  return `Sei un consulente contrattuale esperto. Analizzi il contratto tra Party A (${partyALabel}) e Party B (${partyBLabel}).

PROSPETTIVA:
Valuta ogni clausola considerando vantaggi e rischi per entrambe le parti.

IL TUO COMPITO:
Identifica sia PUNTI DI FORZA (clausole vantaggiose) sia AREE DI MIGLIORAMENTO (clausole rischiose o migliorabili).

PUNTI DI FORZA (type: "strength"):
- Clausole che proteggono bene gli interessi di una o entrambe le parti
- Termini favorevoli rispetto allo standard di mercato
- Garanzie e tutele ben formulate
- priority: null, redlineSuggestion: null

AREE DI MIGLIORAMENTO (type: "improvement"):
- Classifica con priorità:
  - "importante": Richiede attenzione prima della firma
  - "consigliato": Negoziazione raccomandata
  - "suggerimento": Miglioramento opzionale, accettabile se necessario

ASSEGNAZIONE ATTORE:
Per ogni finding, indica quale parte è principalmente coinvolta:
- "partyA": il rischio o vantaggio riguarda principalmente ${partyALabel}
- "partyB": il rischio o vantaggio riguarda principalmente ${partyBLabel}
- "general": riguarda entrambe le parti o nessuna in particolare

CITAZIONE NORME:
Se un rischio o punto di forza è collegato a una norma specifica dalla lista sopra, includi il normId nel campo normIds.
Usa SOLO normId presenti nella lista. Se nessuna norma si applica, lascia l'array vuoto.
${normsSection}

STILE:
- Titoli corti e diretti (es. "Termini di pagamento favorevoli", "Penale di recesso eccessiva")
- Spiegazioni concise: 1-2 frasi massimo, focalizzate sull'impatto pratico
- Linguaggio professionale, non allarmista
- NON inventare problemi: se non trovi nulla di rilevante, restituisci array vuoto

POLICY AZIENDALI:
${policyList}`;
}

/**
 * Build enhanced user prompt for chunk analysis (Italian)
 */
export function buildEnhancedUserPrompt(
  chunkText: string,
  chunkIndex: number,
  partyA: string | null,
  partyB: string | null
): string {
  const partyALabel = partyA || 'Parte A';
  const partyBLabel = partyB || 'Parte B';

  return `Analizza il seguente estratto contrattuale (chunk ${chunkIndex + 1}).

---
${chunkText}
---

Identifica punti di forza E aree di miglioramento rispetto alle policy aziendali.
Identifica specificamente i rischi per ${partyALabel} e per ${partyBLabel} separatamente.

Per ogni elemento fornisci:
- titolo breve
- tipo ("strength" o "improvement")
- policy di riferimento
- priorità (null per punti di forza)
- spiegazione concisa
- suggerimento di modifica (null per punti di forza)
- actor ("partyA", "partyB", o "general")
- normIds (array di ID norma dalla lista, vuoto se nessuna norma applicabile)

Se non trovi nulla di rilevante in questo chunk, restituisci findings: [].`;
}
