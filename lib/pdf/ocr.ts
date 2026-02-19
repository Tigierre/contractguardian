import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// Pre-bundled Italian language data (no CDN download at runtime)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { langPath } = require('@tesseract.js-data/ita');

export interface OCRResult {
  text: string;
  confidence: number;
  pageCount: number;
  characterCount: number;
}

/**
 * Extract images from a PDF buffer using pdfjs-dist,
 * then OCR each image with Tesseract.js (Italian language).
 */
export async function extractTextWithOCR(buffer: Buffer): Promise<OCRResult> {
  // Dynamic import for pdfjs-dist (ESM/CJS compat)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pageCount = doc.numPages;

  const pageTexts: string[] = [];
  const confidences: number[] = [];

  for (let i = 1; i <= pageCount; i++) {
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
              // Convert raw RGBA to PNG using sharp
              const png = await sharp(Buffer.from(imgData.data.buffer), {
                raw: { width: imgData.width, height: imgData.height, channels: 4 },
              })
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

    // If no images extracted, try treating the whole page as having no text
    if (imageBuffers.length === 0) {
      continue;
    }

    // OCR each image with worker API (uses local language data)
    for (const imgBuf of imageBuffers) {
      try {
        const worker = await createWorker('ita', undefined, {
          langPath,
          cacheMethod: 'none', // Already local, no caching needed
        });
        const result = await worker.recognize(imgBuf);
        await worker.terminate();

        if (result.data.text.trim()) {
          pageTexts.push(result.data.text.trim());
          confidences.push(result.data.confidence);
        }
      } catch {
        // Skip individual OCR errors
      }
    }

    page.cleanup();
  }

  await doc.destroy();

  const text = cleanOCRText(pageTexts.join('\n\n'));
  const avgConfidence = confidences.length > 0
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  return {
    text,
    confidence: avgConfidence,
    pageCount,
    characterCount: text.length,
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
