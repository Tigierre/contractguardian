/**
 * Unit tests for error classes and API response helpers
 *
 * @module lib/__tests__/errors.test
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  ExtractionError,
  NotFoundError,
  DatabaseError,
  ServerError,
  AnalysisError,
  createErrorResponse,
  createSuccessResponse,
  isApiError,
  isApiSuccess,
  VALIDATION_MESSAGES,
  EXTRACTION_MESSAGES,
} from '@/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('TEST_ERROR', 'Messaggio di errore', 400, {
        campo: ['Errore campo'],
      });

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Messaggio di errore');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ campo: ['Errore campo'] });
      expect(error.name).toBe('AppError');
    });

    it('should default statusCode to 500', () => {
      const error = new AppError('TEST_ERROR', 'Messaggio');
      expect(error.statusCode).toBe(500);
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('TEST_ERROR', 'Messaggio', 400, { campo: ['Errore'] });
      const json = error.toJSON();

      expect(json).toEqual({
        code: 'TEST_ERROR',
        message: 'Messaggio',
        statusCode: 400,
        details: { campo: ['Errore'] },
      });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct code and statusCode', () => {
      const error = new ValidationError('Formato non valido');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Formato non valido');
      expect(error.name).toBe('ValidationError');
    });

    it('should support details for field-level errors', () => {
      const error = new ValidationError('Errori di validazione', {
        email: ['Email non valida'],
        password: ['Password troppo corta'],
      });

      expect(error.details).toEqual({
        email: ['Email non valida'],
        password: ['Password troppo corta'],
      });
    });

    it('should have Italian default messages', () => {
      expect(VALIDATION_MESSAGES.FILE_EMPTY).toBe('Il file è vuoto');
      expect(VALIDATION_MESSAGES.FILE_TOO_LARGE).toContain('max 10MB');
      expect(VALIDATION_MESSAGES.INVALID_FILE_TYPE).toContain('PDF');
    });
  });

  describe('ExtractionError', () => {
    it('should create extraction error with correct code and statusCode', () => {
      const error = new ExtractionError('Impossibile estrarre testo');

      expect(error.code).toBe('EXTRACTION_ERROR');
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Impossibile estrarre testo');
      expect(error.name).toBe('ExtractionError');
    });

    it('should have Italian default messages', () => {
      expect(EXTRACTION_MESSAGES.NO_TEXT).toContain('Impossibile estrarre testo');
      expect(EXTRACTION_MESSAGES.INSUFFICIENT_TEXT).toContain('troppo poco testo');
      expect(EXTRACTION_MESSAGES.CORRUPTED_PDF).toContain('corrotto');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with correct code and statusCode', () => {
      const error = new NotFoundError('Contratto non trovato');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Contratto non trovato');
      expect(error.name).toBe('NotFoundError');
    });

    it('should use default message if none provided', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Risorsa non trovata');
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with correct code and statusCode', () => {
      const error = new DatabaseError();

      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain('salvataggio dei dati');
      expect(error.name).toBe('DatabaseError');
    });

    it('should support custom message', () => {
      const error = new DatabaseError('Connessione database fallita');
      expect(error.message).toBe('Connessione database fallita');
    });
  });

  describe('ServerError', () => {
    it('should create server error with correct code and statusCode', () => {
      const error = new ServerError();

      expect(error.code).toBe('SERVER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain('Errore interno del server');
      expect(error.name).toBe('ServerError');
    });

    it('should support custom message', () => {
      const error = new ServerError('Servizio non disponibile');
      expect(error.message).toBe('Servizio non disponibile');
    });
  });

  describe('AnalysisError', () => {
    it('should create analysis error with correct code and statusCode', () => {
      const error = new AnalysisError();

      expect(error.code).toBe('ANALYSIS_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.message).toContain('analisi del contratto');
      expect(error.name).toBe('AnalysisError');
    });

    it('should support custom message', () => {
      const error = new AnalysisError('Servizio AI non disponibile');
      expect(error.message).toBe('Servizio AI non disponibile');
    });
  });
});

describe('API Response Helpers', () => {
  describe('createErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new ValidationError('Formato non valido', { campo: ['Errore'] });
      const response = createErrorResponse(error, 'req-123');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Formato non valido');
      expect(response.error.statusCode).toBe(400);
      expect(response.error.details).toEqual({ campo: ['Errore'] });
      expect(response.meta.requestId).toBe('req-123');
      expect(response.meta.timestamp).toBeTypeOf('number');
    });

    it('should format generic Error with generic Italian message', () => {
      const error = new Error('Internal error details');
      const response = createErrorResponse(error);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('SERVER_ERROR');
      expect(response.error.message).toBe('Errore interno del server. Riprova più tardi.');
      expect(response.error.statusCode).toBe(500);
      // Should NOT expose internal error message
      expect(response.error.message).not.toContain('Internal error details');
    });

    it('should handle unknown error types', () => {
      const response = createErrorResponse({ weird: 'object' });

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('SERVER_ERROR');
      expect(response.error.message).toBe('Errore interno del server. Riprova più tardi.');
    });

    it('should work without requestId', () => {
      const error = new ServerError();
      const response = createErrorResponse(error);

      expect(response.meta.requestId).toBeUndefined();
    });
  });

  describe('createSuccessResponse', () => {
    it('should format success response correctly', () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data, 'req-456');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta.requestId).toBe('req-456');
      expect(response.meta.timestamp).toBeTypeOf('number');
    });

    it('should work without requestId', () => {
      const response = createSuccessResponse({ test: true });
      expect(response.meta.requestId).toBeUndefined();
    });
  });

  describe('isApiError', () => {
    it('should return true for error responses', () => {
      const error = new ValidationError('Test error');
      const response = createErrorResponse(error);

      expect(isApiError(response)).toBe(true);
    });

    it('should return false for success responses', () => {
      const response = createSuccessResponse({ test: true });

      expect(isApiError(response)).toBe(false);
    });
  });

  describe('isApiSuccess', () => {
    it('should return true for success responses', () => {
      const response = createSuccessResponse({ test: true });

      expect(isApiSuccess(response)).toBe(true);
    });

    it('should return false for error responses', () => {
      const error = new ValidationError('Test error');
      const response = createErrorResponse(error);

      expect(isApiSuccess(response)).toBe(false);
    });
  });
});
