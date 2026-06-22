import { extractTextFromPDF } from './extractor';
import { extractTextWithOCR } from './ocr';

const MIN_TEXT_LENGTH = 50;
const OCR_CONFIDENCE_WARNING = 60;
const OCR_CONFIDENCE_REJECT = 30;

export interface ExtractionPipelineResult {
  text: string;
  pageCount: number;
  characterCount: number;
  method: 'native' | 'ocr';
  ocrConfidence?: number;
  qualityWarning?: string;
}

/**
 * Unified extraction pipeline: tries native extraction first,
 * falls back to OCR for scanned PDFs, applies quality gates.
 */
export async function extractText(buffer: Buffer): Promise<ExtractionPipelineResult> {
  // 1. Try native text extraction
  try {
    const native = await extractTextFromPDF(buffer);
    if (native.text.length >= MIN_TEXT_LENGTH) {
      return {
        text: native.text,
        pageCount: native.pageCount,
        characterCount: native.characterCount,
        method: 'native',
      };
    }
  } catch {
    // Native extraction failed — fall through to OCR
  }

  // 2. Fallback to OCR
  const ocr = await extractTextWithOCR(buffer);

  // 3. Quality gates
  if (ocr.text.length < MIN_TEXT_LENGTH) {
    throw new Error(
      'Impossibile estrarre testo sufficiente dal PDF. ' +
      'Il documento potrebbe essere vuoto, protetto o in un formato non supportato.'
    );
  }

  if (ocr.confidence < OCR_CONFIDENCE_REJECT) {
    throw new Error(
      `Qualità OCR troppo bassa (${ocr.confidence}%) per un'analisi affidabile. ` +
      'Prova con una scansione di qualità migliore.'
    );
  }

  const warnings: string[] = [];

  if (ocr.truncated) {
    warnings.push(
      `Il documento ha ${ocr.pageCount} pagine: l'OCR è stato limitato alle prime ` +
      `${ocr.pagesProcessed} per contenere i tempi di elaborazione. ` +
      'L\'analisi coprirà solo la parte estratta.'
    );
  }

  if (ocr.confidence < OCR_CONFIDENCE_WARNING) {
    warnings.push(
      `La qualità dell'estrazione OCR è moderata (${ocr.confidence}%). Verifica i risultati dell'analisi.`
    );
  }

  const qualityWarning = warnings.length > 0 ? warnings.join(' ') : undefined;

  return {
    text: ocr.text,
    pageCount: ocr.pageCount,
    characterCount: ocr.characterCount,
    method: 'ocr',
    ocrConfidence: ocr.confidence,
    qualityWarning,
  };
}
