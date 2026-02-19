/**
 * Zod schemas for file upload validation
 *
 * NOTE: Zod schemas validate the shape and basic properties of uploads
 * on the client side. For security, ALWAYS combine with server-side
 * magic bytes validation (see lib/pdf/validator.ts).
 *
 * @module lib/schemas/upload
 */

import { z } from 'zod';

/** Maximum file size: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Accepted MIME types */
const ACCEPTED_FILE_TYPES = ['application/pdf'] as const;

/**
 * Schema for validating a single PDF file upload
 *
 * Validates:
 * - File is present (not null/undefined)
 * - File is not empty (size > 0)
 * - File size is within limit (max 10MB)
 * - File MIME type is application/pdf
 *
 * All error messages are in Italian per UX-04 requirement.
 *
 * @example
 * ```typescript
 * const file = formData.get('file') as File;
 * const result = UploadSchema.safeParse({ file });
 *
 * if (!result.success) {
 *   // result.error.errors[0].message is in Italian
 *   console.error(result.error.flatten());
 * }
 * ```
 */
export const UploadSchema = z.object({
  file: z
    .instanceof(File, {
      message: 'Nessun file selezionato',
    })
    .refine((file) => file.size > 0, {
      message: 'Il file è vuoto',
    })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: 'File troppo grande (max 10MB)',
    })
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type as typeof ACCEPTED_FILE_TYPES[number]), {
      message: 'Formato non valido. Solo file PDF.',
    }),
});

/**
 * TypeScript type inferred from UploadSchema
 */
export type UploadInput = z.infer<typeof UploadSchema>;

/**
 * Schema for validating upload metadata (optional filename, etc.)
 */
export const UploadMetadataSchema = z.object({
  filename: z
    .string()
    .min(1, { message: 'Nome file obbligatorio' })
    .max(255, { message: 'Nome file troppo lungo (max 255 caratteri)' })
    .regex(/^[^<>:"/\\|?*]+$/, {
      message: 'Nome file contiene caratteri non validi',
    })
    .optional(),
});

/**
 * Combined schema for upload with optional metadata
 */
export const UploadWithMetadataSchema = UploadSchema.merge(UploadMetadataSchema);

/**
 * TypeScript type for upload with metadata
 */
export type UploadWithMetadataInput = z.infer<typeof UploadWithMetadataSchema>;

/**
 * Constants for upload validation (exported for reuse)
 */
export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
  /** Human-readable max size */
  MAX_FILE_SIZE_MB: MAX_FILE_SIZE / 1024 / 1024,
} as const;
