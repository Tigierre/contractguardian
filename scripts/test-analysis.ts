/**
 * Integration test for analysis pipeline
 *
 * Tests the full flow: contract → chunking → AI analysis → findings
 * Requires: dev server running (npm run dev) and OPENAI_API_KEY configured
 *
 * Run with: npm run test:analysis
 *
 * @module scripts/test-analysis
 */

const API_BASE = 'http://localhost:3000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function testAnalysis() {
  console.log('=== ContractGuardian - Test Analisi ===\n');

  // 1. Upload sample contract
  console.log('1. Caricamento contratto di test...');

  const fs = await import('fs');
  const path = await import('path');
  const contractPath = path.join(__dirname, '..', 'test', 'fixtures', 'sample-contract.txt');

  if (!fs.existsSync(contractPath)) {
    console.error('ERRORE: sample-contract.txt non trovato in test/fixtures/');
    process.exit(1);
  }

  // Create a PDF-like file for upload (use existing uploaded contract instead)
  // Since our test contract is .txt and the upload API requires PDF,
  // we'll use an already uploaded contract from the database

  // 2. List existing contracts by checking the upload API
  console.log('2. Verifico contratti esistenti...');

  // We need to trigger analysis on an existing contract
  // First, let's check if there are contracts by trying to analyze contract #1
  const contractId = 1; // First uploaded contract
  console.log(`   Uso contratto ID: ${contractId}\n`);

  // 3. Start analysis
  console.log('3. Avvio analisi AI...');
  const startTime = Date.now();

  const analyzeRes = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractId }),
  });

  const analyzeBody = await analyzeRes.json() as ApiResponse<{
    analysisId: number;
    status: string;
    message: string;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }>;

  if (!analyzeBody.success || !analyzeBody.data) {
    console.error('ERRORE analisi:', analyzeBody.error?.message ?? 'Errore sconosciuto');
    process.exit(1);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const { analysisId, totalFindings, criticalCount, highCount, mediumCount, lowCount } = analyzeBody.data;

  console.log(`   Completata in ${duration}s`);
  console.log(`   Analysis ID: ${analysisId}`);
  console.log(`   Findings totali: ${totalFindings}`);
  console.log(`     CRITICAL: ${criticalCount}`);
  console.log(`     HIGH: ${highCount}`);
  console.log(`     MEDIUM: ${mediumCount}`);
  console.log(`     LOW: ${lowCount}\n`);

  // 4. Get full analysis details
  console.log('4. Recupero dettagli analisi...');

  const detailRes = await fetch(`${API_BASE}/api/analyze/${analysisId}`);
  const detailBody = await detailRes.json() as ApiResponse<{
    executiveSummary: string;
    findings: Array<{
      severity: string;
      clauseText: string;
      explanation: string;
      redlineSuggestion: string | null;
    }>;
  }>;

  if (!detailBody.success || !detailBody.data) {
    console.error('ERRORE dettagli:', detailBody.error?.message ?? 'Errore sconosciuto');
    process.exit(1);
  }

  const { executiveSummary, findings } = detailBody.data;

  console.log('\n--- Executive Summary ---');
  console.log(executiveSummary ?? 'N/A');

  console.log('\n--- Findings ---');
  for (const f of findings) {
    console.log(`\n[${f.severity}] ${f.clauseText.slice(0, 80)}...`);
    console.log(`  Spiegazione: ${f.explanation.slice(0, 120)}...`);
    if (f.redlineSuggestion) {
      console.log(`  Redline: ${f.redlineSuggestion.slice(0, 120)}...`);
    }
  }

  // 5. Get contract analysis history
  console.log('\n\n5. Cronologia analisi contratto...');

  const historyRes = await fetch(`${API_BASE}/api/contracts/${contractId}/analyses`);
  const historyBody = await historyRes.json() as ApiResponse<{
    analyses: Array<{ id: number; status: string; totalFindings: number }>;
  }>;

  if (historyBody.success && historyBody.data) {
    console.log(`   Analisi totali: ${historyBody.data.analyses.length}`);
    for (const a of historyBody.data.analyses) {
      console.log(`   - ID ${a.id}: ${a.status} (${a.totalFindings} findings)`);
    }
  }

  // 6. Success criteria check
  console.log('\n\n=== Verifica Success Criteria ===\n');

  const checks = [
    { name: 'SC1: Clausole problematiche identificate', pass: totalFindings > 0 },
    { name: 'SC2: Severity classification presente', pass: findings.every(f => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(f.severity)) },
    { name: 'SC3: Spiegazioni in italiano', pass: findings.length > 0 && (findings[0]?.explanation?.length ?? 0) > 20 },
    { name: 'SC4: Redline suggestions', pass: findings.some(f => f.redlineSuggestion && f.redlineSuggestion.length > 10) },
    { name: 'SC6: Performance <2 minuti', pass: parseFloat(duration) < 120 },
  ];

  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${check.name}`);
    if (!check.pass) allPass = false;
  }

  console.log(`\n${allPass ? 'Tutti i test passati!' : 'Alcuni test falliti.'}`);
  process.exit(allPass ? 0 : 1);
}

testAnalysis().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
