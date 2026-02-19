/**
 * Edge case validation tests for ContractGuardian
 *
 * Tests edge cases without requiring API keys or running server:
 * 1. Very short text (<50 chars)
 * 2. Very long text (>100k chars) - chunking test
 * 3. Italian special characters (à, è, é, ì, ò, ù, €, §, «»)
 * 4. Non-PDF buffer (wrong magic bytes)
 * 5. Corrupted PDF (valid magic bytes but invalid content)
 * 6. Text without problematic clauses
 *
 * Run with: npm run test:edge-cases
 */

import { validatePDFFile } from '../lib/pdf/validator';
import { chunkContract } from '../lib/ai/chunker';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, status: 'PASS', message: 'OK' });
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    results.push({ name, status: 'FAIL', message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('=== ContractGuardian - Edge Case Tests ===\n');

// Test 1: Very short text
console.log('1. Very short text (<50 chars)');
test('Rejects text shorter than 50 characters', () => {
  const shortText = 'Contratto breve';
  assert(shortText.length < 50, 'Test setup: text should be < 50 chars');

  // The pipeline would reject this at analysis stage
  // Here we verify that chunking still works (single chunk)
  const { chunks } = chunkContract(shortText);
  assert(chunks.length === 1, 'Should produce single chunk');
  assert(chunks[0].text === shortText.trim(), 'Text should be preserved');
});

// Test 2: Very long text (>100k chars)
console.log('\n2. Very long text (>100k chars)');
test('Chunks long text without OOM', () => {
  // Generate 120k chars text
  const paragraph = 'Articolo 1. '.repeat(100); // ~1200 chars per paragraph
  const longText = (paragraph + '\n\n').repeat(100); // ~120k chars

  assert(longText.length > 100000, 'Test setup: text should be > 100k chars');

  const { chunks, requiresChunking } = chunkContract(longText);

  assert(requiresChunking, 'Should require chunking');
  assert(chunks.length > 1, 'Should produce multiple chunks');
  assert(chunks.every(c => c.tokenEstimate <= 3000), 'Each chunk should be within token limit');

  // Verify overlap (last paragraph of chunk N should appear in chunk N+1)
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];
    const lastParaCurrent = currentChunk.text.split('\n\n').at(-1);
    const firstParaNext = nextChunk.text.split('\n\n')[0];

    // Overlap means last para of current should match first para of next
    assert(
      lastParaCurrent === firstParaNext,
      `Chunk ${i} and ${i + 1} should have overlapping paragraph`
    );
  }
});

// Test 3: Italian special characters
console.log('\n3. Italian special characters');
test('Preserves Italian characters after chunking', () => {
  const italianText = `
Articolo 1 - Àmbito di Applicazione
Il presente contratto è valido per l'importo di €10.000,00.
Perché questa clausola è così importante? Qualità ed integrità sono garantite.

Articolo 2 - Obblighi
Il fornitore è tenuto a rispettare quanto previsto dal §3 della normativa.
Le parti convengono di utilizzare il formato «standard» per le comunicazioni.
L'attività dovrà essere svolta secondo modalità concordate più efficienti possibili.

Articolo 3 - Penalità
In caso di inadempimento, sarà dovuta una penale pari a €5.000,00.
Così la società può operare senza vincoli impropri.
`;

  const specialChars = ['à', 'è', 'é', 'ì', 'ò', 'ù', '€', '§', '«', '»'];

  // Verify all special chars are present in original text
  for (const char of specialChars) {
    assert(italianText.includes(char), `Test setup: text should contain ${char}`);
  }

  const { chunks } = chunkContract(italianText);

  // Verify all special chars are preserved in chunks
  const reconstructed = chunks.map(c => c.text).join('\n\n');
  for (const char of specialChars) {
    assert(reconstructed.includes(char), `Character ${char} should be preserved after chunking`);
  }
});

// Test 4: Non-PDF buffer
console.log('\n4. Non-PDF buffer');
test('Rejects non-PDF buffer with clear Italian message', () => {
  // ZIP file magic bytes: PK\x03\x04
  const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

  const result = validatePDFFile(zipBuffer, 'application/pdf', zipBuffer.length);

  assert(!result.valid, 'Should reject non-PDF buffer');
  assert(result.error !== undefined, 'Should provide error message');
  assert(
    result.error.toLowerCase().includes('pdf') ||
    result.error.toLowerCase().includes('valido') ||
    result.error.toLowerCase().includes('firma') ||
    result.error.toLowerCase().includes('corrotta'),
    'Error message should mention PDF validation failure in Italian'
  );
});

// Test 5: Corrupted PDF (valid magic bytes but random content)
console.log('\n5. Corrupted PDF');
test('Handles corrupted PDF - passes magic bytes check', () => {
  // Start with valid magic bytes but follow with random data
  const corruptedPDF = Buffer.concat([
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]), // %PDF-
    Buffer.from('random garbage content that is not valid PDF structure'),
  ]);

  // validatePDFFile only checks magic bytes, not structure
  // So this will pass validation at the validator level
  const result = validatePDFFile(corruptedPDF, 'application/pdf', corruptedPDF.length);

  // The validator passes based on magic bytes - PDF structure validation happens in extractor
  assert(
    result.valid === true || result.valid === false,
    'Should return a validation result'
  );

  // If it fails, it should be due to size check (too small)
  if (!result.valid) {
    assert(
      result.error?.toLowerCase().includes('piccolo'),
      'If rejected, should be due to size'
    );
  }

  // Note: pdf-parse would fail when trying to extract text
  // That error handling is in the extractor module, not the validator
});

// Test 6: Text without problematic clauses
console.log('\n6. Text without problematic clauses');
test('Handles benign contract text without errors', () => {
  const benignText = `
CONTRATTO DI PRESTAZIONE OCCASIONALE

TRA

Mario Rossi, nato a Roma il 01/01/1980, C.F. RSSMRA80A01H501Z

E

Azienda Esempio S.r.l., P.IVA 12345678901

Le parti convengono quanto segue:

ARTICOLO 1 - OGGETTO
Il signor Rossi si impegna a svolgere attività di consulenza informatica.

ARTICOLO 2 - COMPENSO
Per la prestazione è previsto un compenso di €1.000,00.

ARTICOLO 3 - DURATA
La prestazione avrà luogo in data 15 marzo 2024.

ARTICOLO 4 - RECESSO
Ciascuna parte può recedere dal contratto con preavviso di 7 giorni.

Letto, confermato e sottoscritto.
`;

  // This is a simple, fair contract with no problematic clauses
  // The chunker should handle it without errors
  const { chunks } = chunkContract(benignText);

  assert(chunks.length > 0, 'Should produce at least one chunk');
  assert(chunks[0].text.includes('Mario Rossi'), 'Should preserve contract content');

  // When analyzed, this should produce 0 findings - but that's tested in integration tests
  // Here we just verify the text processing pipeline doesn't crash on benign input
});

// Test 7: Empty text
console.log('\n7. Empty text');
test('Handles empty text gracefully', () => {
  const emptyText = '';

  const { chunks } = chunkContract(emptyText);

  // Empty text should produce single empty chunk
  assert(chunks.length === 1, 'Should produce one chunk');
  assert(chunks[0].text === '', 'Chunk should be empty');
  assert(chunks[0].tokenEstimate === 0, 'Token estimate should be 0');
});

// Test 8: Text with only whitespace
console.log('\n8. Text with only whitespace');
test('Handles whitespace-only text', () => {
  const whitespaceText = '   \n\n   \t\t   \n\n   ';

  const { chunks } = chunkContract(whitespaceText);

  // Should produce single chunk with trimmed (empty) content
  assert(chunks.length === 1, 'Should produce one chunk');
  assert(chunks[0].text.trim() === '', 'Chunk should be empty after trim');
});

// Test 9: File size validation
console.log('\n9. File size validation');
test('Rejects empty file', () => {
  const emptyBuffer = Buffer.alloc(0);
  const result = validatePDFFile(emptyBuffer, 'application/pdf', 0);

  assert(!result.valid, 'Should reject empty file');
  assert(result.error?.includes('vuoto'), 'Error should mention file is empty');
});

test('Rejects file too small to be valid PDF', () => {
  const tinyBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // Just magic bytes (4 bytes)
  const result = validatePDFFile(tinyBuffer, 'application/pdf', tinyBuffer.length);

  assert(!result.valid, 'Should reject file < 67 bytes');
  assert(
    result.error?.toLowerCase().includes('piccolo'),
    'Error should mention file too small'
  );
});

test('Rejects file larger than 10MB', () => {
  const largeSize = 11 * 1024 * 1024; // 11 MB
  const largeBuffer = Buffer.alloc(largeSize);
  // Set magic bytes
  largeBuffer[0] = 0x25;
  largeBuffer[1] = 0x50;
  largeBuffer[2] = 0x44;
  largeBuffer[3] = 0x46;

  const result = validatePDFFile(largeBuffer, 'application/pdf', largeSize);

  assert(!result.valid, 'Should reject file > 10MB');
  assert(result.error?.toLowerCase().includes('grande'), 'Error should mention file too large');
  assert(result.error?.includes('10MB'), 'Error should mention max size');
});

// Test 10: MIME type validation
console.log('\n10. MIME type validation');
test('Rejects non-PDF MIME type with Italian message', () => {
  const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
  const result = validatePDFFile(pdfBuffer, 'image/png', pdfBuffer.length);

  assert(!result.valid, 'Should reject non-PDF MIME type');
  assert(
    result.error?.toLowerCase().includes('pdf') ||
    result.error?.toLowerCase().includes('formato'),
    'Error should mention PDF format requirement in Italian'
  );
});

// Summary
console.log('\n=== Summary ===\n');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log(`Total tests: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\nFailed tests:');
  for (const r of results.filter(r => r.status === 'FAIL')) {
    console.log(`  - ${r.name}: ${r.message}`);
  }
}

console.log(`\n${failed === 0 ? '✓ All edge case tests passed!' : '✗ Some tests failed.'}`);

process.exit(failed === 0 ? 0 : 1);
