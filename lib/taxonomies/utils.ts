/**
 * Contract Type Taxonomy Utilities
 *
 * Helper functions for looking up and mapping contract types.
 *
 * @see Phase 8 Plan 01 - Contract Type Taxonomy
 */

import { CONTRACT_TYPES, type ContractTypeKey, type ContractTypeId, type ContractType } from './contract-types';

/**
 * Get contract type by ID
 *
 * @param id - Contract type ID (e.g., 'nda', 'service_agreement')
 * @returns Contract type object or undefined if not found
 *
 * @example
 * const ndaType = getContractTypeById('nda');
 * console.log(ndaType?.labelKey); // 'contractTypes.nda'
 */
export function getContractTypeById(id: string): ContractType | undefined {
  return Object.values(CONTRACT_TYPES).find(type => type.id === id);
}

/**
 * Get all contract types as array
 *
 * @returns Array of all 12 contract type objects
 *
 * @example
 * const types = getAllContractTypes();
 * console.log(types.length); // 12
 */
export function getAllContractTypes(): ContractType[] {
  return Object.values(CONTRACT_TYPES);
}

/**
 * Get all contract type keys
 *
 * @returns Array of ContractTypeKey values (e.g., ['NDA', 'SERVICE_AGREEMENT', ...])
 *
 * @example
 * const keys = getContractTypeKeys();
 * console.log(keys[0]); // 'NDA'
 */
export function getContractTypeKeys(): ContractTypeKey[] {
  return Object.keys(CONTRACT_TYPES) as ContractTypeKey[];
}

/**
 * Get all contract type IDs
 *
 * @returns Array of all contract type ID strings
 *
 * @example
 * const ids = getContractTypeIds();
 * console.log(ids); // ['nda', 'service_agreement', 'employment', ...]
 */
export function getContractTypeIds(): ContractTypeId[] {
  return Object.values(CONTRACT_TYPES).map(type => type.id);
}

/**
 * Check if a string is a valid contract type ID
 *
 * @param id - String to check
 * @returns True if ID matches a known contract type
 *
 * @example
 * isValidContractTypeId('nda'); // true
 * isValidContractTypeId('invalid'); // false
 */
export function isValidContractTypeId(id: string): id is ContractTypeId {
  return getContractTypeIds().includes(id as ContractTypeId);
}
