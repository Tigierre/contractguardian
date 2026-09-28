/**
 * Unit tests for finding deduplication utilities
 *
 * @module lib/ai/__tests__/deduplicate.test
 */

import { describe, it, expect } from 'vitest';
import { deduplicateFindings, sortFindings } from '@/lib/ai/deduplicate';
import type { Finding } from '@/lib/ai/schemas';

describe('Finding Deduplicator', () => {
  describe('deduplicateFindings', () => {
    it('should keep all unique findings', () => {
      const findings: Finding[] = [
        {
          clauseText: 'Il venditore può modificare i termini unilateralmente.',
          policyName: 'Modifiche unilaterali',
          severity: 'CRITICAL',
          explanation: 'Rischio alto',
          redlineSuggestion: 'Richiedere consenso scritto',
        },
        {
          clauseText: 'Il contratto dura 5 anni con rinnovo automatico.',
          policyName: 'Durata contratto',
          severity: 'MEDIUM',
          explanation: 'Attenzione ai rinnovi',
          redlineSuggestion: 'Ridurre durata a 2 anni',
        },
      ];

      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(2);
      expect(result).toEqual(findings);
    });

    it('should remove exact duplicates', () => {
      const finding: Finding = {
        clauseText: 'Il venditore può modificare i termini unilateralmente.',
        policyName: 'Modifiche unilaterali',
        severity: 'CRITICAL',
        explanation: 'Rischio alto',
        redlineSuggestion: 'Richiedere consenso scritto',
      };

      const findings: Finding[] = [finding, finding, finding];

      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(finding);
    });

    it('should remove findings with >80% similarity', () => {
      const findings: Finding[] = [
        {
          clauseText: 'Il venditore può modificare unilateralmente i termini del contratto in ogni momento.',
          policyName: 'Modifiche unilaterali',
          severity: 'CRITICAL',
          explanation: 'Rischio',
          redlineSuggestion: 'Fix',
        },
        {
          clauseText: 'Il venditore può modificare unilateralmente i termini del contratto ogni momento.',
          policyName: 'Modifiche unilaterali',
          severity: 'CRITICAL',
          explanation: 'Rischio',
          redlineSuggestion: 'Fix',
        },
      ];

      const result = deduplicateFindings(findings);

      // Should deduplicate because similarity > 80% (only difference is "in")
      expect(result).toHaveLength(1);
    });

    it('should keep findings with <80% similarity', () => {
      const findings: Finding[] = [
        {
          clauseText: 'Il venditore può modificare i termini unilateralmente.',
          policyName: 'Modifiche',
          severity: 'CRITICAL',
          explanation: 'A',
          redlineSuggestion: 'B',
        },
        {
          clauseText: 'Penale del 50% applicabile in caso di recesso anticipato.',
          policyName: 'Penali',
          severity: 'HIGH',
          explanation: 'C',
          redlineSuggestion: 'D',
        },
      ];

      const result = deduplicateFindings(findings);

      // Should keep both because texts are completely different
      expect(result).toHaveLength(2);
    });

    it('should preserve first occurrence when deduplicating', () => {
      const finding1: Finding = {
        clauseText: 'Il venditore può modificare termini.',
        policyName: 'Policy 1',
        severity: 'CRITICAL',
        explanation: 'First',
        redlineSuggestion: 'First suggestion',
      };

      const finding2: Finding = {
        clauseText: 'Il venditore può modificare termini.',
        policyName: 'Policy 2',
        severity: 'HIGH',
        explanation: 'Second',
        redlineSuggestion: 'Second suggestion',
      };

      const findings = [finding1, finding2];
      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(finding1); // First occurrence preserved
    });

    it('should handle empty array', () => {
      const result = deduplicateFindings([]);
      expect(result).toEqual([]);
    });

    it('should handle single finding', () => {
      const finding: Finding = {
        clauseText: 'Test clause',
        policyName: 'Test policy',
        severity: 'LOW',
        explanation: 'Test',
        redlineSuggestion: 'Test fix',
      };

      const result = deduplicateFindings([finding]);
      expect(result).toEqual([finding]);
    });
  });

  describe('sortFindings', () => {
    // Forma attuale di un finding: `type` (strength/improvement) + `priority`
    // (importante/consigliato/suggerimento, null per i punti di forza).
    const make = (
      clauseText: string,
      type: Finding['type'],
      priority: Finding['priority']
    ): Finding => ({
      title: clauseText,
      clauseText,
      type,
      policyName: 'P',
      priority,
      explanation: 'X',
      redlineSuggestion: type === 'improvement' ? 'Y' : null,
    });

    it('mette prima i miglioramenti per priorità, poi i punti di forza', () => {
      const findings: Finding[] = [
        make('forza', 'strength', null),
        make('suggerimento', 'improvement', 'suggerimento'),
        make('importante', 'improvement', 'importante'),
        make('consigliato', 'improvement', 'consigliato'),
      ];

      const result = sortFindings(findings);

      expect(result.map((f) => f.clauseText)).toEqual([
        'importante',
        'consigliato',
        'suggerimento',
        'forza',
      ]);
    });

    it("non modifica l'array originale", () => {
      const findings: Finding[] = [
        make('B', 'strength', null),
        make('A', 'improvement', 'importante'),
      ];
      const original = [...findings];

      const result = sortFindings(findings);

      expect(findings).toEqual(original);
      expect(result).not.toEqual(findings);
    });

    it('gestisce un array vuoto', () => {
      expect(sortFindings([])).toEqual([]);
    });

    it('gestisce un singolo finding', () => {
      const finding = make('unico', 'improvement', 'consigliato');
      expect(sortFindings([finding])).toEqual([finding]);
    });

    it("mantiene l'ordine a parità di priorità (ordinamento stabile)", () => {
      const findings: Finding[] = [
        make('primo', 'improvement', 'importante'),
        make('secondo', 'improvement', 'importante'),
      ];

      const result = sortFindings(findings);

      expect(result[0]?.clauseText).toBe('primo');
      expect(result[1]?.clauseText).toBe('secondo');
    });
  });
});
