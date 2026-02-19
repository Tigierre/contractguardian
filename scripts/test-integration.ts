/**
 * Integration test suite for ContractGuardian
 *
 * Tests full pipeline with 5 diverse contract types:
 * 1. Load contract text from fixtures
 * 2. Insert into DB as contract
 * 3. POST /api/analyze (async)
 * 4. Poll GET /api/analyze/[id] for completion
 * 5. Verify results (status, findings, severity, summary)
 * 6. Test PDF export
 *
 * Run with: npm run test:integration
 * Requires: dev server running (npm run dev), OPENAI_API_KEY configured
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Direct imports (tsx doesn't support @/ aliases)
import { db } from '../src/lib/db';
import { contracts } from '../db/schema';

const API_BASE = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 180000; // 3 minutes

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface AnalysisStatus {
  id: number;
  status: 'processing' | 'completed' | 'failed';
  progressStage?: string;
  progressDetail?: string;
  totalChunks?: number;
  currentChunk?: number;
  errorMessage?: string | null;
  counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  executiveSummary?: string | null;
  findings: Array<{
    severity: string;
    clauseText: string;
    explanation: string;
    redlineSuggestion: string | null;
  }>;
}

const CONTRACTS = [
  {
    name: 'NDA',
    file: 'nda.txt',
    description: 'Accordo di riservatezza con penali sproporzionate',
  },
  {
    name: 'Service Agreement',
    file: 'service-agreement.txt',
    description: 'Contratto di fornitura IT con responsabilità unilaterale',
  },
  {
    name: 'Partnership',
    file: 'partnership.txt',
    description: 'Joint venture con governance sbilanciata',
  },
  {
    name: 'Employment',
    file: 'employment.txt',
    description: 'Contratto di lavoro con non-compete eccessivo',
  },
  {
    name: 'Licensing',
    file: 'licensing.txt',
    description: 'Licenza software con royalty elevate',
  },
];

interface TestResult {
  contract: string;
  status: 'PASS' | 'FAIL';
  duration: number;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  hasSummary: boolean;
  hasPDF: boolean;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForCompletion(analysisId: number): Promise<AnalysisStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME) {
    const res = await fetch(`${API_BASE}/api/analyze/${analysisId}`);
    const body = await res.json() as ApiResponse<AnalysisStatus>;

    if (!body.success || !body.data) {
      throw new Error(`Polling error: ${body.error?.message ?? 'Unknown error'}`);
    }

    const analysis = body.data;

    if (analysis.status === 'completed') {
      return analysis;
    }

    if (analysis.status === 'failed') {
      throw new Error(`Analysis failed: ${analysis.errorMessage ?? 'Unknown error'}`);
    }

    // Still processing, show progress
    const progress = analysis.progressDetail || analysis.progressStage || 'In corso...';
    process.stdout.write(`\r   ${progress}    `);

    await sleep(POLL_INTERVAL);
  }

  throw new Error('Timeout: analisi non completata entro 3 minuti');
}

async function testContract(name: string, file: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // 1. Load contract text
    const contractPath = path.join(__dirname, '..', 'test', 'fixtures', 'contracts', file);
    const contractText = fs.readFileSync(contractPath, 'utf-8');

    // 2. Insert into DB
    const [contract] = await db
      .insert(contracts)
      .values({
        filename: file,
        originalText: contractText,
        status: 'uploaded',
      })
      .returning();

    if (!contract) {
      throw new Error('Failed to insert contract');
    }

    const contractId = contract.id;

    // 3. Start analysis
    const analyzeRes = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId }),
    });

    const analyzeBody = await analyzeRes.json() as ApiResponse<{
      analysisId: number;
      status: string;
    }>;

    if (!analyzeBody.success || !analyzeBody.data) {
      throw new Error(`Analysis start failed: ${analyzeBody.error?.message ?? 'Unknown'}`);
    }

    const analysisId = analyzeBody.data.analysisId;

    // 4. Poll for completion
    process.stdout.write(`   Polling for completion...`);
    const analysis = await pollForCompletion(analysisId);
    process.stdout.write(`\r                                        \r`); // Clear progress line

    // 5. Verify results
    const hasFindings = analysis.counts.total > 0;
    const hasSeverityClassification = analysis.findings.every(f =>
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(f.severity)
    );
    const hasSummary = !!analysis.executiveSummary && analysis.executiveSummary.length > 20;

    if (!hasFindings) {
      throw new Error('No findings detected (expected problematic clauses)');
    }

    if (!hasSeverityClassification) {
      throw new Error('Severity classification missing or invalid');
    }

    if (!hasSummary) {
      throw new Error('Executive summary missing or too short');
    }

    // 6. Test PDF export
    const pdfRes = await fetch(`${API_BASE}/api/report/${analysisId}/export`);
    const hasPDF = pdfRes.ok && pdfRes.headers.get('content-type') === 'application/pdf';

    if (!hasPDF) {
      throw new Error('PDF export failed or wrong content-type');
    }

    const duration = (Date.now() - startTime) / 1000;

    return {
      contract: name,
      status: 'PASS',
      duration,
      findings: analysis.counts.total,
      critical: analysis.counts.critical,
      high: analysis.counts.high,
      medium: analysis.counts.medium,
      low: analysis.counts.low,
      hasSummary: true,
      hasPDF: true,
    };
  } catch (err: unknown) {
    const duration = (Date.now() - startTime) / 1000;
    const message = err instanceof Error ? err.message : 'Unknown error';

    return {
      contract: name,
      status: 'FAIL',
      duration,
      findings: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      hasSummary: false,
      hasPDF: false,
      error: message,
    };
  }
}

async function runIntegrationTests() {
  console.log('=== ContractGuardian - Integration Tests ===\n');
  console.log(`Testing ${CONTRACTS.length} diverse contract types...\n`);

  const results: TestResult[] = [];

  for (const contract of CONTRACTS) {
    console.log(`Testing: ${contract.name}`);
    console.log(`  Description: ${contract.description}`);

    const result = await testContract(contract.name, contract.file);
    results.push(result);

    if (result.status === 'PASS') {
      console.log(`  ✓ PASS (${result.duration.toFixed(1)}s)`);
      console.log(`    Findings: ${result.findings} (CRITICAL: ${result.critical}, HIGH: ${result.high}, MEDIUM: ${result.medium}, LOW: ${result.low})`);
      console.log(`    Summary: ${result.hasSummary ? '✓' : '✗'}`);
      console.log(`    PDF Export: ${result.hasPDF ? '✓' : '✗'}`);
    } else {
      console.log(`  ✗ FAIL (${result.duration.toFixed(1)}s)`);
      console.log(`    Error: ${result.error}`);
    }

    console.log('');
  }

  // Summary table
  console.log('\n=== Summary ===\n');
  console.log('┌─────────────────────┬────────┬──────────┬──────────┬─────────┬─────────┬────────┬─────────┐');
  console.log('│ Contract            │ Status │ Duration │ Findings │ Crit.   │ High    │ Medium │ Low     │');
  console.log('├─────────────────────┼────────┼──────────┼──────────┼─────────┼─────────┼────────┼─────────┤');

  for (const r of results) {
    const name = r.contract.padEnd(19);
    const status = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
    const duration = `${r.duration.toFixed(1)}s`.padStart(8);
    const findings = r.findings.toString().padStart(8);
    const critical = r.critical.toString().padStart(7);
    const high = r.high.toString().padStart(7);
    const medium = r.medium.toString().padStart(6);
    const low = r.low.toString().padStart(7);

    console.log(`│ ${name} │ ${status}  │ ${duration} │ ${findings} │ ${critical} │ ${high} │ ${medium} │ ${low} │`);
  }

  console.log('└─────────────────────┴────────┴──────────┴──────────┴─────────┴─────────┴────────┴─────────┘');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  console.log(`Total duration: ${totalDuration.toFixed(1)}s`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  - ${r.contract}: ${r.error}`);
    }
  }

  console.log(`\n${failed === 0 ? '✓ All integration tests passed!' : '✗ Some tests failed.'}`);

  process.exit(failed === 0 ? 0 : 1);
}

runIntegrationTests().catch((err) => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
