/**
 * Contract Type Taxonomy
 *
 * Defines the 12 main contract types recognized by ContractGuardian.
 * Uses TypeScript const objects for zero runtime overhead and full type inference.
 *
 * @see Phase 8 Plan 01 - Contract Type Taxonomy
 */

export const CONTRACT_TYPES = {
  NDA: {
    id: 'nda',
    labelKey: 'contractTypes.nda',
    description: 'contractTypes.nda.description',
  },
  SERVICE_AGREEMENT: {
    id: 'service_agreement',
    labelKey: 'contractTypes.serviceAgreement',
    description: 'contractTypes.serviceAgreement.description',
  },
  EMPLOYMENT: {
    id: 'employment',
    labelKey: 'contractTypes.employment',
    description: 'contractTypes.employment.description',
  },
  PARTNERSHIP: {
    id: 'partnership',
    labelKey: 'contractTypes.partnership',
    description: 'contractTypes.partnership.description',
  },
  PURCHASE: {
    id: 'purchase',
    labelKey: 'contractTypes.purchase',
    description: 'contractTypes.purchase.description',
  },
  LEASE: {
    id: 'lease',
    labelKey: 'contractTypes.lease',
    description: 'contractTypes.lease.description',
  },
  LICENSE: {
    id: 'license',
    labelKey: 'contractTypes.license',
    description: 'contractTypes.license.description',
  },
  VENDOR: {
    id: 'vendor',
    labelKey: 'contractTypes.vendor',
    description: 'contractTypes.vendor.description',
  },
  LOAN: {
    id: 'loan',
    labelKey: 'contractTypes.loan',
    description: 'contractTypes.loan.description',
  },
  DISTRIBUTION: {
    id: 'distribution',
    labelKey: 'contractTypes.distribution',
    description: 'contractTypes.distribution.description',
  },
  FRANCHISE: {
    id: 'franchise',
    labelKey: 'contractTypes.franchise',
    description: 'contractTypes.franchise.description',
  },
  OTHER: {
    id: 'other',
    labelKey: 'contractTypes.other',
    description: 'contractTypes.other.description',
  },
} as const;

/**
 * Type helpers for type-safe contract type handling
 */
export type ContractTypeKey = keyof typeof CONTRACT_TYPES;
export type ContractTypeId = typeof CONTRACT_TYPES[ContractTypeKey]['id'];

/**
 * Contract type object structure
 */
export type ContractType = typeof CONTRACT_TYPES[ContractTypeKey];
