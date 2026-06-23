import { describe, it, expect, vi, afterEach } from 'vitest';
import { pollExtractionStatus } from '../poll-extraction';
import type { ApiResponse, ExtractionStatusResponse } from '@/src/types/api';

/**
 * Test dell'helper di polling dell'estrazione (CPERF-1 step 2, "OCR vero-async").
 * Coprono i casi terminali raggiunti al primo poll (nessuna attesa reale) + i
 * percorsi d'errore. Il loop di attesa multi-iterazione dipende dai timer e non
 * è coperto qui per non introdurre flakiness da fake-timer.
 */

function mockFetchOnce(body: ApiResponse<ExtractionStatusResponse>, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pollExtractionStatus', () => {
  it('restituisce la risposta quando lo stato è già "uploaded"', async () => {
    const payload: ExtractionStatusResponse = {
      id: 7,
      filename: 'contratto.pdf',
      status: 'uploaded',
      textLength: 1234,
      pageCount: 5,
      extractionMethod: 'native',
    };
    vi.stubGlobal('fetch', mockFetchOnce({ success: true, data: payload }));

    const result = await pollExtractionStatus(7);

    expect(result.status).toBe('uploaded');
    expect(result.pageCount).toBe(5);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/contracts/7/extraction',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('restituisce la risposta (senza lanciare) quando lo stato è "extraction_failed"', async () => {
    const payload: ExtractionStatusResponse = {
      id: 9,
      filename: 'scan.pdf',
      status: 'extraction_failed',
      extractionError: 'Qualità OCR troppo bassa',
    };
    vi.stubGlobal('fetch', mockFetchOnce({ success: true, data: payload }));

    const result = await pollExtractionStatus(9);

    expect(result.status).toBe('extraction_failed');
    expect(result.extractionError).toBe('Qualità OCR troppo bassa');
  });

  it('lancia con il messaggio del server su risposta non riuscita', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ success: false, error: { code: 'NOT_FOUND', message: 'Contratto non trovato' } }, false)
    );

    await expect(pollExtractionStatus(404)).rejects.toThrow('Contratto non trovato');
  });

  it('si interrompe subito se il chiamante annulla il polling', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      pollExtractionStatus(1, { isCancelled: () => true })
    ).rejects.toThrow('cancelled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
