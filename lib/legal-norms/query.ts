/**
 * Legal Norms Query Utilities
 *
 * Provides type-safe queries for the legal norms database.
 * Static JSON data from Italia, EU, and USA jurisdictions.
 *
 * @see Phase 8 Plan 02 - Legal Norms Database
 */

import italiaData from './italia.json';
import euData from './eu.json';
import usaData from './usa.json';
import type { ContractTypeId } from '@/lib/taxonomies/contract-types';

/**
 * Supported jurisdictions
 */
export type Jurisdiction = 'italia' | 'eu' | 'usa';

/**
 * Legal norm structure
 */
export interface LegalNorm {
  normId: string;
  title: string;
  citation: string;
  category: string;
  url: string;
  relevance: Record<ContractTypeId, number>;
}

/**
 * Norm database structure
 */
export interface NormDatabase {
  jurisdiction: Jurisdiction;
  lastUpdated: string;
  norms: LegalNorm[];
}

/**
 * In-memory norm databases
 */
const databases: Record<Jurisdiction, NormDatabase> = {
  italia: italiaData as NormDatabase,
  eu: euData as NormDatabase,
  usa: usaData as NormDatabase,
};

/**
 * Query norms by contract type and jurisdiction
 *
 * Returns norms sorted by relevance (highest first).
 *
 * @param contractType - Contract type ID (e.g., 'nda', 'service_agreement')
 * @param jurisdiction - Legal jurisdiction ('italia', 'eu', 'usa')
 * @param minRelevance - Minimum relevance threshold (0-1), default 0.7
 * @returns Array of norms sorted by relevance
 *
 * @example
 * const norms = queryNormsByTypeAndJurisdiction('nda', 'italia', 0.8);
 * // Returns Italian norms for NDAs with relevance >= 0.8
 */
export function queryNormsByTypeAndJurisdiction(
  contractType: ContractTypeId,
  jurisdiction: Jurisdiction,
  minRelevance: number = 0.7
): LegalNorm[] {
  const db = databases[jurisdiction];
  if (!db) {
    throw new Error(`Unknown jurisdiction: ${jurisdiction}`);
  }

  return db.norms
    .filter((norm) => norm.relevance[contractType] >= minRelevance)
    .sort((a, b) => b.relevance[contractType] - a.relevance[contractType]);
}

/**
 * Get all norms for a jurisdiction
 *
 * @param jurisdiction - Legal jurisdiction
 * @returns All norms for the jurisdiction
 *
 * @example
 * const allNorms = getAllNormsForJurisdiction('eu');
 */
export function getAllNormsForJurisdiction(jurisdiction: Jurisdiction): LegalNorm[] {
  const db = databases[jurisdiction];
  if (!db) {
    throw new Error(`Unknown jurisdiction: ${jurisdiction}`);
  }
  return db.norms;
}

/**
 * Get a specific norm by ID
 *
 * Searches across all jurisdictions.
 *
 * @param normId - Norm identifier (e.g., 'cc-1321', 'gdpr-6', 'ucc-2-201')
 * @returns The norm, or undefined if not found
 *
 * @example
 * const norm = getNormById('cc-1321');
 * // Returns Italian Civil Code Art. 1321
 */
export function getNormById(normId: string): LegalNorm | undefined {
  for (const db of Object.values(databases)) {
    const norm = db.norms.find((n) => n.normId === normId);
    if (norm) return norm;
  }
  return undefined;
}

/**
 * Get last updated date for a jurisdiction
 *
 * @param jurisdiction - Legal jurisdiction
 * @returns ISO date string
 *
 * @example
 * const lastUpdated = getLastUpdatedDate('italia');
 * // Returns '2026-02-15'
 */
export function getLastUpdatedDate(jurisdiction: Jurisdiction): string {
  const db = databases[jurisdiction];
  if (!db) {
    throw new Error(`Unknown jurisdiction: ${jurisdiction}`);
  }
  return db.lastUpdated;
}

/**
 * Get all supported jurisdictions
 *
 * @returns Array of jurisdiction identifiers
 *
 * @example
 * const jurisdictions = getSupportedJurisdictions();
 * // Returns ['italia', 'eu', 'usa']
 */
export function getSupportedJurisdictions(): Jurisdiction[] {
  return Object.keys(databases) as Jurisdiction[];
}

/**
 * Get contract types with high relevance norms for a jurisdiction
 *
 * Returns contract types that have at least one norm with relevance >= threshold.
 *
 * @param jurisdiction - Legal jurisdiction
 * @param minRelevance - Minimum relevance threshold, default 0.8
 * @returns Array of contract type IDs with relevant norms
 *
 * @example
 * const types = getContractTypesWithNorms('italia', 0.9);
 * // Returns contract types with highly relevant Italian norms
 */
export function getContractTypesWithNorms(
  jurisdiction: Jurisdiction,
  minRelevance: number = 0.8
): ContractTypeId[] {
  const db = databases[jurisdiction];
  if (!db) {
    throw new Error(`Unknown jurisdiction: ${jurisdiction}`);
  }

  const contractTypeSet = new Set<ContractTypeId>();

  for (const norm of db.norms) {
    for (const [contractType, relevance] of Object.entries(norm.relevance)) {
      if (relevance >= minRelevance) {
        contractTypeSet.add(contractType as ContractTypeId);
      }
    }
  }

  return Array.from(contractTypeSet);
}

/**
 * Query norms across multiple jurisdictions
 *
 * Returns norms from all specified jurisdictions, sorted by relevance.
 *
 * @param contractType - Contract type ID
 * @param jurisdictions - Array of jurisdictions to query
 * @param minRelevance - Minimum relevance threshold, default 0.7
 * @returns Array of norms with jurisdiction metadata
 *
 * @example
 * const norms = queryNormsMultiJurisdiction('nda', ['italia', 'eu'], 0.85);
 * // Returns Italian and EU norms for NDAs
 */
export function queryNormsMultiJurisdiction(
  contractType: ContractTypeId,
  jurisdictions: Jurisdiction[],
  minRelevance: number = 0.7
): Array<LegalNorm & { jurisdiction: Jurisdiction }> {
  const results: Array<LegalNorm & { jurisdiction: Jurisdiction }> = [];

  for (const jurisdiction of jurisdictions) {
    const norms = queryNormsByTypeAndJurisdiction(contractType, jurisdiction, minRelevance);
    for (const norm of norms) {
      results.push({ ...norm, jurisdiction });
    }
  }

  // Sort by relevance across all jurisdictions
  return results.sort((a, b) => b.relevance[contractType] - a.relevance[contractType]);
}
