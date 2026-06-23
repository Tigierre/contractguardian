import { describe, it, expect } from 'vitest';
import { dedupeContractText } from '../text-dedup';

describe('dedupeContractText (CPERF-5)', () => {
  it('keeps a single source intact (no false dedup)', () => {
    const text = 'Clausola uno: oggetto del contratto.\n\nClausola due: durata.';
    const r = dedupeContractText([{ filename: 'a.pdf', text }]);

    expect(r.removedBlocks).toBe(0);
    expect(r.combinedText).toContain('--- a.pdf ---');
    expect(r.combinedText).toContain('Clausola uno');
    expect(r.combinedText).toContain('Clausola due');
  });

  it('drops byte-identical boilerplate repeated across files', () => {
    const boilerplate = 'Informativa privacy ai sensi del Regolamento UE 2016/679 e successive modifiche.';
    const r = dedupeContractText([
      { filename: 'contratto.pdf', text: `Oggetto del contratto.\n\n${boilerplate}` },
      { filename: 'allegato.pdf', text: `${boilerplate}\n\nAllegato tecnico specifico.` },
    ]);

    expect(r.removedBlocks).toBe(1);
    // boilerplate appears once, both unique blocks survive
    const occurrences = r.combinedText.split(boilerplate).length - 1;
    expect(occurrences).toBe(1);
    expect(r.combinedText).toContain('Oggetto del contratto.');
    expect(r.combinedText).toContain('Allegato tecnico specifico.');
    expect(r.dedupedChars).toBeLessThan(r.originalChars);
  });

  it('dedups case/whitespace-insensitively (normalized key)', () => {
    const a = 'Le parti convengono quanto segue in via definitiva.';
    const b = 'LE   PARTI   convengono quanto segue in via definitiva.';
    const r = dedupeContractText([
      { filename: 'x.pdf', text: a },
      { filename: 'y.pdf', text: b },
    ]);

    expect(r.removedBlocks).toBe(1);
  });

  it('drops lightly reworded substantial blocks via near-dedup', () => {
    const base = 'Il presente accordo regola i rapporti commerciali tra le parti contraenti per la fornitura dei beni indicati in allegato al contratto principale.';
    const reworded = base.replace('regola', 'disciplina'); // one-word change → high Jaccard
    const r = dedupeContractText([
      { filename: 'a.pdf', text: base },
      { filename: 'b.pdf', text: reworded },
    ]);

    expect(r.removedBlocks).toBe(1);
  });

  it('preserves file separators and does not dedup them', () => {
    const r = dedupeContractText([
      { filename: 'a.pdf', text: 'Testo unico nel file A.' },
      { filename: 'b.pdf', text: 'Testo unico nel file B.' },
    ]);

    expect(r.combinedText).toContain('--- a.pdf ---');
    expect(r.combinedText).toContain('--- b.pdf ---');
    expect(r.removedBlocks).toBe(0);
  });
});
