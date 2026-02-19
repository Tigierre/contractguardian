/**
 * PDF Text Extraction Utilities
 *
 * Uses pdf-parse v1 to extract text from native digital PDFs.
 * NOTE: pdf-parse only works with text-based PDFs (not scanned images).
 * OCR support for scanned PDFs will be added in Phase 3.
 *
 * @module lib/pdf/extractor
 */

// pdf-parse v1 uses CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

/** Minimum text length required for a valid extraction */
const MIN_TEXT_LENGTH = 50;

/**
 * Result of successful text extraction
 */
export interface ExtractionResult {
  /** Cleaned extracted text */
  text: string;
  /** Number of pages in the PDF */
  pageCount: number;
  /** Total character count of extracted text */
  characterCount: number;
  /** Document metadata (if available) */
  metadata: {
    title?: string;
    author?: string;
    creationDate?: Date;
  };
}

/**
 * Cleans extracted text by normalizing whitespace
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/gm, '')
    .trim();
}

/**
 * Extracts text from PDF buffer using pdf-parse v1
 *
 * @param buffer - PDF file buffer
 * @returns Extracted text and metadata
 * @throws Error with Italian message if extraction fails
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // pdf-parse v1 API: simple function call
    const data = await pdfParse(buffer);

    // Check if any text was extracted
    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        'Impossibile estrarre testo dal PDF. ' +
        'Potrebbe essere un documento scansionato (immagine) o un PDF protetto. ' +
        'Al momento supportiamo solo PDF con testo digitale.'
      );
    }

    // Clean the extracted text
    const cleanText = cleanExtractedText(data.text);

    // Validate minimum text length
    if (cleanText.length < MIN_TEXT_LENGTH) {
      throw new Error(
        `Il PDF contiene troppo poco testo (${cleanText.length} caratteri, minimo ${MIN_TEXT_LENGTH}). ` +
        'Verifica che il documento non sia vuoto o danneggiato.'
      );
    }

    return {
      text: cleanText,
      pageCount: data.numpages || 1,
      characterCount: cleanText.length,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
      },
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Re-throw our custom errors
      if (error.message.includes('Impossibile') || error.message.includes('troppo poco')) {
        throw error;
      }

      // Check for common pdf-parse errors
      const message = error.message.toLowerCase();

      if (message.includes('invalid pdf') || message.includes('bad pdf')) {
        throw new Error(
          'Il file PDF sembra essere corrotto o danneggiato. ' +
          'Prova a rigenerare il PDF o usa un file diverso.'
        );
      }

      if (message.includes('encrypted') || message.includes('password')) {
        throw new Error(
          'Il PDF è protetto da password. ' +
          'Rimuovi la protezione prima di caricarlo.'
        );
      }
    }

    // Generic extraction error
    throw new Error(
      "Errore durante l'estrazione del testo dal PDF. " +
      'Il file potrebbe essere corrotto o in un formato non supportato.'
    );
  }
}

/**
 * Quick check if PDF appears to be text-based (not scanned)
 */
export async function isTextBasedPDF(buffer: Buffer): Promise<boolean> {
  try {
    const result = await extractTextFromPDF(buffer);
    return result.text.length >= MIN_TEXT_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Constants exported for use in other modules
 */
export const EXTRACTION_CONSTANTS = {
  MIN_TEXT_LENGTH,
} as const;
