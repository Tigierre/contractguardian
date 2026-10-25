import { afterEach, describe, expect, it, vi } from 'vitest';
import { aspettoIstanza } from '@/lib/tema-di-casa';
import { contrasto } from '@/lib/temi/temi';

describe('aspettoIstanza', () => {
  afterEach(() => vi.restoreAllMocks());

  it('env vuote: nessun attributo e nessuno stile (aspetto di serie)', () => {
    expect(aspettoIstanza({})).toEqual({ attributi: {}, stile: undefined });
    expect(aspettoIstanza({ BRAND_THEME: '  ', BRAND_ACCENT: '' })).toEqual({ attributi: {}, stile: undefined });
  });

  it('tema valido: data-tema e il primo modo del tema', () => {
    expect(aspettoIstanza({ BRAND_THEME: 'acciaio' }).attributi).toEqual({ 'data-tema': 'acciaio', 'data-modo': 'chiaro' });
    expect(aspettoIstanza({ BRAND_THEME: 'officina', BRAND_MODE: 'scuro' }).attributi).toEqual({
      'data-tema': 'officina',
      'data-modo': 'scuro',
    });
  });

  it('id sconosciuto: aspetto di serie e un avviso nel log, una volta sola', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(aspettoIstanza({ BRAND_THEME: 'tema-che-non-esiste' }).attributi).toEqual({});
    aspettoIstanza({ BRAND_THEME: 'tema-che-non-esiste' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('tema-che-non-esiste');
  });

  it('modo che il tema non ha: si usa quello del tema, con avviso', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(aspettoIstanza({ BRAND_THEME: 'acciaio', BRAND_MODE: 'scuro' }).attributi['data-modo']).toBe('chiaro');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('accento chiaro: testo sopra scuro, calcolato per il contrasto', () => {
    const stile = aspettoIstanza({ BRAND_THEME: 'acciaio', BRAND_ACCENT: '#ffd400' }).stile as Record<string, string>;
    expect(stile['--primary']).toBe('#ffd400');
    expect(stile['--on-primary']).not.toBe('#ffffff');
    expect(contrasto(stile['--primary']!, stile['--on-primary']!)!).toBeGreaterThanOrEqual(4.5);
  });

  it('accento scuro: testo sopra bianco; vale anche senza tema', () => {
    const aspetto = aspettoIstanza({ BRAND_ACCENT: '#1d4ed8' });
    expect(aspetto.attributi).toEqual({});
    expect((aspetto.stile as Record<string, string>)['--on-primary']).toBe('#ffffff');
  });

  it('accento non valido: nessuno stile, avviso', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(aspettoIstanza({ BRAND_THEME: 'acciaio', BRAND_ACCENT: 'giallo' }).stile).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('BRAND_BAND non entra: l\'app non ha una barra', () => {
    expect(aspettoIstanza({ BRAND_THEME: 'acciaio', BRAND_BAND: '#000000' }).stile).toBeUndefined();
  });
});
