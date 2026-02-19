/**
 * Unit tests for PDF validation utilities
 *
 * @module lib/pdf/__tests__/validator.test
 */

import { describe, it, expect } from 'vitest';
import {
  validatePDFMagicBytes,
  validateFileSize,
  validateMimeType,
  validatePDFFile,
  PDF_VALIDATION_CONSTANTS,
} from '@/lib/pdf/validator';

describe('PDF Validator', () => {
  describe('validatePDFMagicBytes', () => {
    it('should return true for valid PDF signature', () => {
      // %PDF-1.4 signature
      const validPDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(validatePDFMagicBytes(validPDF)).toBe(true);
    });

    it('should return true for any PDF version signature', () => {
      // %PDF- is sufficient (version doesn't matter for magic bytes)
      const pdfStart = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
      expect(validatePDFMagicBytes(pdfStart)).toBe(true);
    });

    it('should return false for non-PDF signature', () => {
      // ZIP file signature (PK)
      const zipFile = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(validatePDFMagicBytes(zipFile)).toBe(false);
    });

    it('should return false for JPEG signature', () => {
      const jpegFile = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(validatePDFMagicBytes(jpegFile)).toBe(false);
    });

    it('should return false for buffer too small', () => {
      const tooSmall = Buffer.from([0x25, 0x50]); // Only 2 bytes
      expect(validatePDFMagicBytes(tooSmall)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const empty = Buffer.from([]);
      expect(validatePDFMagicBytes(empty)).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    const { MAX_FILE_SIZE, MIN_FILE_SIZE } = PDF_VALIDATION_CONSTANTS;

    it('should return error for zero-size file', () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Il file è vuoto');
    });

    it('should return error for file too small', () => {
      const result = validateFileSize(50); // Less than MIN_FILE_SIZE (67 bytes)
      expect(result.valid).toBe(false);
      expect(result.error).toContain('troppo piccolo');
    });

    it('should accept file at minimum size', () => {
      const result = validateFileSize(MIN_FILE_SIZE);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept file at maximum size', () => {
      const result = validateFileSize(MAX_FILE_SIZE);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for file over maximum size', () => {
      const result = validateFileSize(MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('troppo grande');
      expect(result.error).toContain('max 10MB');
    });

    it('should include file size in error message for oversized files', () => {
      const size = 15 * 1024 * 1024; // 15MB
      const result = validateFileSize(size);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15.00MB');
    });

    it('should accept valid file size in middle range', () => {
      const result = validateFileSize(5 * 1024 * 1024); // 5MB
      expect(result.valid).toBe(true);
    });
  });

  describe('validateMimeType', () => {
    it('should accept application/pdf', () => {
      const result = validateMimeType('application/pdf');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject image/jpeg', () => {
      const result = validateMimeType('image/jpeg');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Formato file non valido');
      expect(result.error).toContain('PDF');
    });

    it('should reject image/png', () => {
      const result = validateMimeType('image/png');
      expect(result.valid).toBe(false);
    });

    it('should reject application/octet-stream', () => {
      const result = validateMimeType('application/octet-stream');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validateMimeType('');
      expect(result.valid).toBe(false);
    });

    it('should have Italian error message', () => {
      const result = validateMimeType('text/plain');
      expect(result.error).toContain('file PDF');
    });
  });

  describe('validatePDFFile', () => {
    const validPDFBuffer = Buffer.from([
      0x25,
      0x50,
      0x44,
      0x46, // %PDF
      0x2d,
      0x31,
      0x2e,
      0x34, // -1.4
      ...Array(100).fill(0x20), // Padding to make it large enough
    ]);
    const validSize = validPDFBuffer.length;
    const validMime = 'application/pdf';

    it('should accept valid PDF', () => {
      const result = validatePDFFile(validPDFBuffer, validMime, validSize);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid MIME type (fast check)', () => {
      const result = validatePDFFile(validPDFBuffer, 'image/jpeg', validSize);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Formato file non valido');
    });

    it('should reject invalid file size', () => {
      const result = validatePDFFile(validPDFBuffer, validMime, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('vuoto');
    });

    it('should reject invalid magic bytes (security check)', () => {
      const fakeBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0x20)]);
      const result = validatePDFFile(fakeBuffer, validMime, fakeBuffer.length);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('firma file corrotta');
    });

    it('should perform checks in order: MIME → size → magic bytes', () => {
      // Invalid MIME should fail before size check
      const oversizedBuffer = Buffer.from(Array(11 * 1024 * 1024).fill(0x25));
      const result = validatePDFFile(oversizedBuffer, 'image/jpeg', oversizedBuffer.length);
      expect(result.error).toContain('Formato file non valido');
      expect(result.error).not.toContain('troppo grande');
    });

    it('should have all error messages in Italian', () => {
      const results = [
        validatePDFFile(validPDFBuffer, 'image/jpeg', validSize), // Wrong MIME
        validatePDFFile(validPDFBuffer, validMime, 0), // Empty
        validatePDFFile(Buffer.from([0x00, 0x00]), validMime, 100), // Wrong magic
      ];

      results.forEach((result) => {
        expect(result.valid).toBe(false);
        // All Italian error messages should not contain common English error words
        expect(result.error?.toLowerCase()).not.toContain('invalid');
        expect(result.error?.toLowerCase()).not.toContain('error');
      });
    });
  });

  describe('PDF_VALIDATION_CONSTANTS', () => {
    it('should export correct constants', () => {
      expect(PDF_VALIDATION_CONSTANTS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      expect(PDF_VALIDATION_CONSTANTS.MIN_FILE_SIZE).toBe(67);
      expect(PDF_VALIDATION_CONSTANTS.ACCEPTED_MIME_TYPES).toEqual(['application/pdf']);
    });
  });
});
