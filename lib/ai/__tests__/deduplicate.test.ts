/**
 * Unit tests for finding deduplication utilities
 *
 * @module lib/ai/__tests__/deduplicate.test
 */

import { describe, it, expect } from 'vitest';
import { deduplicateFindings, sortBySeverity } from '@/lib/ai/deduplicate';
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

  describe('sortBySeverity', () => {
    it('should sort findings from CRITICAL to LOW', () => {
      const findings: Finding[] = [
        {
          clauseText: 'Low issue',
          policyName: 'P1',
          severity: 'LOW',
          explanation: 'A',
          redlineSuggestion: 'B',
        },
        {
          clauseText: 'Critical issue',
          policyName: 'P2',
          severity: 'CRITICAL',
          explanation: 'C',
          redlineSuggestion: 'D',
        },
        {
          clauseText: 'Medium issue',
          policyName: 'P3',
          severity: 'MEDIUM',
          explanation: 'E',
          redlineSuggestion: 'F',
        },
        {
          clauseText: 'High issue',
          policyName: 'P4',
          severity: 'HIGH',
          explanation: 'G',
          redlineSuggestion: 'H',
        },
      ];

      const result = sortBySeverity(findings);

      expect(result[0]?.severity).toBe('CRITICAL');
      expect(result[1]?.severity).toBe('HIGH');
      expect(result[2]?.severity).toBe('MEDIUM');
      expect(result[3]?.severity).toBe('LOW');
    });

    it('should not mutate original array', () => {
      const findings: Finding[] = [
        {
          clauseText: 'A',
          policyName: 'P',
          severity: 'LOW',
          explanation: 'X',
          redlineSuggestion: 'Y',
        },
        {
          clauseText: 'B',
          policyName: 'P',
          severity: 'CRITICAL',
          explanation: 'X',
          redlineSuggestion: 'Y',
        },
      ];

      const original = [...findings];
      const result = sortBySeverity(findings);

      expect(findings).toEqual(original); // Original unchanged
      expect(result).not.toEqual(findings); // Result is different order
    });

    it('should handle empty array', () => {
      const result = sortBySeverity([]);
      expect(result).toEqual([]);
    });

    it('should handle single finding', () => {
      const finding: Finding = {
        clauseText: 'Test',
        policyName: 'Test',
        severity: 'MEDIUM',
        explanation: 'Test',
        redlineSuggestion: 'Test',
      };

      const result = sortBySeverity([finding]);
      expect(result).toEqual([finding]);
    });

    it('should preserve order for same severity', () => {
      const findings: Finding[] = [
        {
          clauseText: 'First critical',
          policyName: 'P1',
          severity: 'CRITICAL',
          explanation: 'A',
          redlineSuggestion: 'B',
        },
        {
          clauseText: 'Second critical',
          policyName: 'P2',
          severity: 'CRITICAL',
          explanation: 'C',
          redlineSuggestion: 'D',
        },
      ];

      const result = sortBySeverity(findings);

      // Both CRITICAL, should preserve original order
      expect(result[0]?.clauseText).toBe('First critical');
      expect(result[1]?.clauseText).toBe('Second critical');
    });
  });
});
