/**
 * PDF Validation Utilities
 *
 * SECURITY: Always validate magic bytes, not just MIME type.
 * See: RESEARCH.md Pitfall 1 - Client MIME types can be spoofed.
 *
 * @module lib/pdf/validator
 */

/** PDF magic bytes: %PDF- (hex: 25 50 44 46) */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);

/** Maximum file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Minimum file size to be a valid PDF (header + minimal structure) */
const MIN_FILE_SIZE = 67; // Smallest valid PDF is ~67 bytes

/**
 * Result of a validation check
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates PDF magic bytes (%PDF-)
 *
 * PDF files must start with the signature "%PDF-" (hex: 25 50 44 46).
 * This check prevents file extension spoofing attacks where a malicious
 * file is renamed to .pdf but contains different content.
 *
 * @param buffer - File buffer to validate
 * @returns true if buffer starts with PDF signature
 *
 * @example
 * ```typescript
 * const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
 * validatePDFMagicBytes(buffer); // true
 *
 * const fakeBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP signature
 * validatePDFMagicBytes(fakeBuffer); // false
 * ```
 */
export function validatePDFMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  const magicBytes = buffer.subarray(0, 4);
  return magicBytes.equals(PDF_MAGIC_BYTES);
}

/**
 * Validates file size against minimum and maximum limits
 *
 * @param size - File size in bytes
 * @returns ValidationResult with Italian error message if invalid
 *
 * @example
 * ```typescript
 * validateFileSize(0); // { valid: false, error: 'Il file è vuoto' }
 * validateFileSize(5000); // { valid: true }
 * validateFileSize(15 * 1024 * 1024); // { valid: false, error: 'File troppo grande...' }
 * ```
 */
export function validateFileSize(size: number): ValidationResult {
  if (size === 0) {
    return {
      valid: false,
      error: 'Il file è vuoto',
    };
  }

  if (size < MIN_FILE_SIZE) {
    return {
      valid: false,
      error: 'Il file è troppo piccolo per essere un PDF valido',
    };
  }

  if (size > MAX_FILE_SIZE) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    return {
      valid: false,
      error: `File troppo grande (max 10MB). Dimensione attuale: ${sizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validates MIME type for PDF
 *
 * NOTE: This is a "fast check" for honest mistakes but should NOT be trusted
 * for security. Client-provided MIME types can be spoofed.
 * Always combine with magic bytes validation.
 *
 * @param mimeType - Client-provided MIME type
 * @returns ValidationResult with Italian error message if invalid
 */
export function validateMimeType(mimeType: string): ValidationResult {
  if (mimeType !== 'application/pdf') {
    return {
      valid: false,
      error: 'Formato file non valido. Accettiamo solo file PDF.',
    };
  }

  return { valid: true };
}

/**
 * Complete PDF file validation
 *
 * Performs a comprehensive validation of a PDF file:
 * 1. MIME type check (fast, catches honest mistakes)
 * 2. File size validation (prevents DoS and empty files)
 * 3. Magic bytes verification (security: prevents file spoofing)
 *
 * @param buffer - File buffer
 * @param mimeType - Client-provided MIME type
 * @param size - File size in bytes
 * @returns ValidationResult with specific Italian error message
 *
 * @example
 * ```typescript
 * const buffer = await file.arrayBuffer();
 * const result = validatePDFFile(
 *   Buffer.from(buffer),
 *   file.type,
 *   file.size
 * );
 *
 * if (!result.valid) {
 *   console.error(result.error); // Italian error message
 * }
 * ```
 */
export function validatePDFFile(
  buffer: Buffer,
  mimeType: string,
  size: number
): ValidationResult {
  // Step 1: Check MIME type (fast check for user mistakes)
  const mimeCheck = validateMimeType(mimeType);
  if (!mimeCheck.valid) {
    return mimeCheck;
  }

  // Step 2: Validate file size
  const sizeCheck = validateFileSize(size);
  if (!sizeCheck.valid) {
    return sizeCheck;
  }

  // Step 3: Validate magic bytes (security check - most important)
  if (!validatePDFMagicBytes(buffer)) {
    return {
      valid: false,
      error: 'Il file non è un PDF valido (firma file corrotta o modificata).',
    };
  }

  return { valid: true };
}

/**
 * Constants exported for use in other modules (e.g., Zod schemas)
 */
export const PDF_VALIDATION_CONSTANTS = {
  MAX_FILE_SIZE,
  MIN_FILE_SIZE,
  ACCEPTED_MIME_TYPES: ['application/pdf'] as const,
} as const;
