/**
 * Custom error classes for ContractGuardian
 *
 * All user-facing messages are in Italian per UX-04 requirement.
 * These errors follow the CLAUDE.md API response format for consistent
 * error handling across the application.
 *
 * @module lib/errors
 */

/**
 * Error details structure for API responses
 */
export interface ErrorDetails {
  /** Machine-readable error code (e.g., "VALIDATION_ERROR") */
  code: string;
  /** Human-readable message in Italian */
  message: string;
  /** Additional field-specific error details */
  details?: Record<string, string[]>;
  /** HTTP status code */
  statusCode?: number;
}

/**
 * Base application error class
 *
 * All custom errors extend this class, providing:
 * - Consistent error codes for programmatic handling
 * - Italian messages for user display
 * - HTTP status codes for API responses
 * - Optional field-level details for form validation
 *
 * @example
 * ```typescript
 * throw new AppError(
 *   'CUSTOM_ERROR',
 *   'Descrizione errore in italiano',
 *   400,
 *   { campo: ['Messaggio di validazione'] }
 * );
 * ```
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace in V8 environments (Node.js, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to API response format
   */
  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    };
  }
}

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * File/input validation errors
 *
 * Use for:
 * - Invalid file format
 * - File too large/small
 * - Missing required fields
 * - Invalid input format
 *
 * @example
 * ```typescript
 * throw new ValidationError('Formato file non valido. Solo PDF.');
 * throw new ValidationError('Errori di validazione', {
 *   email: ['Email non valida'],
 *   password: ['Password troppo corta']
 * });
 * ```
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Pre-defined validation error messages (Italian)
 */
export const VALIDATION_MESSAGES = {
  // File validation
  FILE_EMPTY: 'Il file è vuoto',
  FILE_TOO_LARGE: 'File troppo grande (max 10MB)',
  FILE_TOO_SMALL: 'Il file è troppo piccolo per essere un PDF valido',
  INVALID_FILE_TYPE: 'Formato file non valido. Accettiamo solo file PDF.',
  INVALID_PDF_SIGNATURE: 'Il file non è un PDF valido (firma file corrotta o modificata).',
  NO_FILE_SELECTED: 'Nessun file selezionato',

  // Input validation
  REQUIRED_FIELD: 'Campo obbligatorio',
  INVALID_EMAIL: 'Indirizzo email non valido',
  INVALID_FORMAT: 'Formato non valido',
} as const;

// =============================================================================
// Extraction Errors (422)
// =============================================================================

/**
 * PDF text extraction errors
 *
 * Use for:
 * - Empty/unreadable PDF
 * - Scanned PDF (no text layer)
 * - Encrypted/protected PDF
 * - Corrupted PDF structure
 *
 * HTTP 422 (Unprocessable Entity) indicates the request was well-formed
 * but the content could not be processed.
 *
 * @example
 * ```typescript
 * throw new ExtractionError('Impossibile estrarre testo dal PDF.');
 * ```
 */
export class ExtractionError extends AppError {
  constructor(message: string) {
    super('EXTRACTION_ERROR', message, 422);
    this.name = 'ExtractionError';
  }
}

/**
 * Pre-defined extraction error messages (Italian)
 */
export const EXTRACTION_MESSAGES = {
  NO_TEXT: 'Impossibile estrarre testo dal PDF. Potrebbe essere un documento scansionato.',
  INSUFFICIENT_TEXT: 'Il PDF contiene troppo poco testo per essere analizzato.',
  CORRUPTED_PDF: 'Il file PDF sembra essere corrotto o danneggiato.',
  PASSWORD_PROTECTED: 'Il PDF è protetto da password. Rimuovi la protezione prima di caricarlo.',
  UNSUPPORTED_FORMAT: 'Formato PDF non supportato.',
} as const;

// =============================================================================
// Resource Errors (404)
// =============================================================================

/**
 * Resource not found errors
 *
 * Use for:
 * - Contract not found
 * - Policy not found
 * - Report not found
 *
 * @example
 * ```typescript
 * throw new NotFoundError('Contratto non trovato');
 * throw new NotFoundError(); // Uses default message
 * ```
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Risorsa non trovata') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

// =============================================================================
// Database Errors (500)
// =============================================================================

/**
 * Database operation errors
 *
 * Use for:
 * - Connection failures
 * - Query errors
 * - Transaction failures
 *
 * NOTE: Don't expose internal database errors to users.
 * Log the actual error server-side but return a generic message.
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(...);
 * } catch (err) {
 *   console.error('DB Error:', err);
 *   throw new DatabaseError();
 * }
 * ```
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Errore durante il salvataggio dei dati. Riprova.') {
    super('DATABASE_ERROR', message, 500);
    this.name = 'DatabaseError';
  }
}

// =============================================================================
// Server Errors (500)
// =============================================================================

/**
 * Generic server errors
 *
 * Use for:
 * - Unexpected errors
 * - External service failures
 * - Configuration errors
 *
 * NOTE: Don't expose internal error details to users.
 *
 * @example
 * ```typescript
 * throw new ServerError(); // Generic message
 * throw new ServerError('Servizio temporaneamente non disponibile');
 * ```
 */
export class ServerError extends AppError {
  constructor(message: string = 'Errore interno del server. Riprova più tardi.') {
    super('SERVER_ERROR', message, 500);
    this.name = 'ServerError';
  }
}

// =============================================================================
// Analysis Errors (502/503)
// =============================================================================

/**
 * AI analysis errors
 *
 * Use for:
 * - AI service unavailable
 * - Analysis timeout
 * - Invalid AI response
 *
 * @example
 * ```typescript
 * throw new AnalysisError('Il servizio di analisi è temporaneamente non disponibile.');
 * ```
 */
export class AnalysisError extends AppError {
  constructor(message: string = "Errore durante l'analisi del contratto. Riprova.") {
    super('ANALYSIS_ERROR', message, 503);
    this.name = 'AnalysisError';
  }
}

// =============================================================================
// API Response Helpers
// =============================================================================

/**
 * Standardized error response format for API routes
 *
 * Follows CLAUDE.md ApiResponse structure with:
 * - success: always false for errors
 * - error: ErrorDetails object
 * - meta: timestamp and request context
 */
export interface ApiErrorResponse {
  success: false;
  error: ErrorDetails;
  meta: {
    timestamp: number;
    requestId?: string;
  };
}

/**
 * Standardized success response format for API routes
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: number;
    requestId?: string;
  };
}

/**
 * Union type for API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create standardized error response for API routes
 *
 * Handles both custom AppError instances and generic Error objects.
 * For security, unknown errors are logged but not exposed to clients.
 *
 * @param error - Error to format
 * @param requestId - Optional request ID for tracing
 * @returns Formatted API error response
 *
 * @example
 * ```typescript
 * // In API route
 * try {
 *   // ... processing
 * } catch (error) {
 *   const response = createErrorResponse(error);
 *   return NextResponse.json(response, { status: response.error.statusCode });
 * }
 * ```
 */
export function createErrorResponse(
  error: AppError | Error | unknown,
  requestId?: string
): ApiErrorResponse {
  const timestamp = Date.now();

  // Handle custom AppError instances
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.toJSON(),
      meta: { timestamp, requestId },
    };
  }

  // Log unknown errors for debugging (don't expose to client)
  if (error instanceof Error) {
    console.error('[API Error]', error.message, error.stack);
  } else {
    console.error('[API Error]', error);
  }

  // Return generic error (don't expose internals)
  return {
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'Errore interno del server. Riprova più tardi.',
      statusCode: 500,
    },
    meta: { timestamp, requestId },
  };
}

/**
 * Create standardized success response for API routes
 *
 * @param data - Response data
 * @param requestId - Optional request ID for tracing
 * @returns Formatted API success response
 *
 * @example
 * ```typescript
 * return NextResponse.json(createSuccessResponse({ id: 1, name: 'Contract' }));
 * ```
 */
export function createSuccessResponse<T>(data: T, requestId?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      requestId,
    },
  };
}

/**
 * Type guard to check if a response is an error
 */
export function isApiError(response: ApiResponse<unknown>): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if a response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}
