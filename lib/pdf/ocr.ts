import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Pre-bundled Italian language data (no CDN download at runtime)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { langPath } = require('@tesseract.js-data/ita');

/**
 * Cap di pagine sottoposte a OCR. Oltre questa soglia le pagine eccedenti NON
 * vengono elaborate (vedi `truncated`/qualityWarning): evita che una scansione
 * di centinaia di pagine blocchi l'upload (CPERF-1). Override via `OCR_MAX_PAGES`.
 */
const OCR_MAX_PAGES = Math.max(1, Number(process.env.OCR_MAX_PAGES) || 30);

/**
 * Larghezza massima (px) a cui ridimensionare le immagini prima dell'OCR.
 * Il downscale riduce RAM e tempo Tesseract con qualità invariata su scansioni
 * A4 a ~200dpi (~1700px). Override via `OCR_MAX_IMAGE_WIDTH`.
 */
const OCR_MAX_IMAGE_WIDTH = Math.max(512, Number(process.env.OCR_MAX_IMAGE_WIDTH) || 2000);

/**
 * Time-box complessivo dell'OCR (ms). Superato il limite si interrompe tra una
 * pagina e l'altra e si restituisce ciò che è stato estratto finora (`truncated`).
 * Tiene la richiesta di upload entro tempi ragionevoli. Override via `OCR_TIMEOUT_MS`.
 */
const OCR_TIMEOUT_MS = Math.max(30_000, Number(process.env.OCR_TIMEOUT_MS) || 4 * 60 * 1000);

export interface OCRResult {
  text: string;
  confidence: number;
  pageCount: number;
  characterCount: number;
  /** Pagine effettivamente sottoposte a OCR (≤ pageCount). */
  pagesProcessed: number;
  /** True se l'OCR si è fermato prima della fine (cap pagine o time-box). */
  truncated: boolean;
}

/**
 * Extract images from a PDF buffer using pdfjs-dist,
 * then OCR each image with Tesseract.js (Italian language).
 *
 * Performance (CPERF-1): un SOLO worker Tesseract viene creato e riusato per
 * tutte le immagini del documento (in precedenza ne veniva creato uno per ogni
 * immagine, ricaricando ogni volta motore e dizionario). In più: cap di pagine,
 * downscale delle immagini e time-box complessivo.
 */
export async function extractTextWithOCR(buffer: Buffer): Promise<OCRResult> {
  // Dynamic import for pdfjs-dist (ESM/CJS compat)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = doc.numPages;

  const pagesToProcess = Math.min(pageCount, OCR_MAX_PAGES);
  const deadline = Date.now() + OCR_TIMEOUT_MS;

  const pageTexts: string[] = [];
  const confidences: number[] = [];
  let pagesProcessed = 0;
  // Già "tronco" se il cap pagine taglia il documento; può diventarlo anche per time-box.
  let truncated = pagesToProcess < pageCount;

  // Worker Tesseract creato UNA volta e riusato per tutte le immagini (CPERF-1).
  const worker = await createWorker('ita', undefined, {
    langPath,
    cacheMethod: 'none', // Already local, no caching needed
  });

  try {
    for (let i = 1; i <= pagesToProcess; i++) {
      // Time-box: interrompe in modo pulito tra una pagina e l'altra.
      if (Date.now() >= deadline) {
        truncated = true;
        break;
      }

      const page = await doc.getPage(i);
      const ops = await page.getOperatorList();

      // Extract images from operator list
      const imageBuffers: Buffer[] = [];
      for (let j = 0; j < ops.fnArray.length; j++) {
        // OPS.paintImageXObject = 85, OPS.paintInlineImageXObject = 86
        if (ops.fnArray[j] === 85 || ops.fnArray[j] === 86) {
          try {
            const imgName = ops.argsArray[j]?.[0];
            if (typeof imgName === 'string') {
              const img = await page.objs.get(imgName);
              if (img && 'data' in img && 'width' in img && 'height' in img) {
                const imgData = img as { data: Uint8ClampedArray; width: number; height: number };
                // Convert raw RGBA to PNG using sharp, con downscale per cappare RAM/tempo OCR
                const png = await sharp(Buffer.from(imgData.data.buffer), {
                  raw: { width: imgData.width, height: imgData.height, channels: 4 },
                })
                  .resize({ width: OCR_MAX_IMAGE_WIDTH, withoutEnlargement: true })
                  .png()
                  .toBuffer();
                imageBuffers.push(png);
              }
            }
          } catch {
            // Skip individual image extraction errors
          }
        }
      }

      // OCR each image reusing the single worker (local language data)
      for (const imgBuf of imageBuffers) {
        try {
          const result = await worker.recognize(imgBuf);
          if (result.data.text.trim()) {
            pageTexts.push(result.data.text.trim());
            confidences.push(result.data.confidence);
          }
        } catch {
          // Skip individual OCR errors
        }
      }

      page.cleanup();
      pagesProcessed++;
    }
  } finally {
    await worker.terminate();
    await doc.destroy();
  }

  const text = cleanOCRText(pageTexts.join('\n\n'));
  const avgConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  return {
    text,
    confidence: avgConfidence,
    pageCount,
    characterCount: text.length,
    pagesProcessed,
    truncated,
  };
}

function cleanOCRText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/gm, '')
    .trim();
}
