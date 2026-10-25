/**
 * I TEMI DI CASA — il pezzo comune che ogni prodotto COPIA (non reinventa).
 *
 * Fonte: `hub-base/temi/temi.json`. Il blocco «dati generati» qui sotto e `temi.css` li
 * riscrive `node genera.mjs`: non si toccano a mano. Il resto di questo file è la logica,
 * uguale per tutti i prodotti.
 *
 * ── COME ARRIVA ALLA PAGINA ──────────────────────────────────────────────────
 * `temi.css` porta un blocco `[data-tema='<id>']` (e `[data-modo='scuro']` dove il tema ce
 * l'ha) con i 13 token + gli slot, ognuno in esadecimale (`--bg`) e in canali (`--bg-rgb`,
 * per `rgb(var(--bg-rgb) / α)` di Tailwind). Il prodotto mette sull'involucro (di solito
 * `<html>`) gli attributi e lo stile di `voltoDaEnv()`: il tema SCELTO e, inline, l'accento
 * e la barra D'ISTANZA, che vincono sul tema.
 *
 * ── LE TRE REGOLE ────────────────────────────────────────────────────────────
 * ① Il default è del PRODOTTO: `diSerie` lo passa il prodotto (il suo aspetto storico), mai
 *   un colore di cliente. Env vuota = il volto di sempre.
 * ② Un solo slot d'identità: l'accento (`BRAND_ACCENT`) rimappa `--primary`, con
 *   `--on-primary` e `--primary-hover` CALCOLATI. La barra (`BRAND_BAND`) è la sola deroga,
 *   ammessa solo scura: se `--band-fg` non regge 4.5:1 sopra, si scarta.
 * ③ Un valore sbagliato non rompe niente: finisce in `avvisi` (da mettere nel log) e si
 *   scende al gradino di sotto.
 * ⛔ Mai il nome di un cliente nel nome di un tema.
 */

// <dati generati> — da temi.json con `node genera.mjs`; non modificare a mano
export const TEMI = [
  { id: 'nova', numero: 1, nome: 'Nova Carbone', modi: ['scuro'] },
  { id: 'aurora', numero: 2, nome: 'Aurora Chiaro', modi: ['chiaro'] },
  { id: 'neon', numero: 3, nome: 'Neon Vault', modi: ['scuro'] },
  { id: 'sabbia', numero: 4, nome: 'Editoriale Sabbia', modi: ['chiaro'] },
  { id: 'foresta', numero: 5, nome: 'Foresta Profonda', modi: ['scuro'] },
  { id: 'officina', numero: 6, nome: 'Officina Calda', modi: ['chiaro', 'scuro'] },
  { id: 'acciaio', numero: 7, nome: 'Acciaio Chiaro', modi: ['chiaro'] },
] as const;
/** `band-fg` di ogni tema e modo: serve a decidere se una barra d'istanza è leggibile. */
export const TESTO_SU_BARRA: Record<string, string> = {
  'nova/scuro': '#eef2f7',
  'aurora/chiaro': '#f6f8fb',
  'neon/scuro': '#e6f1ff',
  'sabbia/chiaro': '#f5efe6',
  'foresta/scuro': '#e8f5ef',
  'officina/chiaro': '#f3f3ef',
  'officina/scuro': '#f3f3ef',
  'acciaio/chiaro': '#f7f7f8',
};
// </dati generati>

export type IdTema = (typeof TEMI)[number]['id'];
export type Modo = 'chiaro' | 'scuro';

/** Il quasi nero da usare sopra un accento chiaro. */
export const INCHIOSTRO_SCURO = '#1a1a17';

// ── Aritmetica dei colori ────────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

/** `#rrggbb` o `#rgb` → canali; `null` se non è un colore. */
export function rgb(hex: string | null | undefined): RGB | null {
  const v = (hex ?? '').trim().replace(/^#/, '');
  const esteso = v.length === 3 ? v.replace(/./g, (c) => c + c) : v;
  if (!/^[0-9a-f]{6}$/i.test(esteso)) return null;
  const n = parseInt(esteso, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hex(c: RGB): string {
  return '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** `#rrggbb` → «r g b», la forma che Tailwind legge in `rgb(var(--x-rgb) / α)`. */
export function canali(colore: string): string | null {
  const c = rgb(colore);
  return c ? `${c.r} ${c.g} ${c.b}` : null;
}

function luminanza(c: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Rapporto di contrasto WCAG fra due colori; `null` se uno dei due non lo è. */
export function contrasto(a: string, b: string): number | null {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return null;
  const lx = luminanza(x);
  const ly = luminanza(y);
  return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
}

/** Il testo sopra l'accento: bianco se regge 4.5:1, altrimenti quasi nero. Si calcola, non si stima. */
export function inchiostroSopra(accento: string): string {
  const c = contrasto(accento, '#ffffff');
  return c !== null && c >= 4.5 ? '#ffffff' : INCHIOSTRO_SCURO;
}

/**
 * `--primary-hover` DERIVATO dall'accento: del 12% verso il nero se sopra c'è testo chiaro,
 * verso il bianco se sopra c'è testo scuro, così il contrasto col testo sopra non scende.
 */
export function accentoHover(accento: string, sopra: string): string {
  const a = rgb(accento);
  const s = rgb(sopra);
  if (!a) return accento;
  const meta = s && luminanza(s) < 0.5 ? 255 : 0;
  const mescola = (v: number) => Math.round(v + (meta - v) * 0.12);
  return hex({ r: mescola(a.r), g: mescola(a.g), b: mescola(a.b) });
}

// ── Scelta del tema ──────────────────────────────────────────────────────────

export function temaValido(v: unknown): v is IdTema {
  return typeof v === 'string' && TEMI.some((t) => t.id === v);
}

/** Il modo da usare: quello chiesto se il tema ce l'ha, altrimenti il primo del tema. */
export function modoDi(tema: IdTema, chiesto?: string | null): Modo {
  const modi = TEMI.find((t) => t.id === tema)!.modi as readonly Modo[];
  return chiesto && (modi as readonly string[]).includes(chiesto) ? (chiesto as Modo) : modi[0]!; // ogni tema ha almeno un modo
}

/** Le variabili dell'accento d'istanza (esadecimale e canali); vuoto se non è un colore. */
export function variabiliAccento(accento: string | null | undefined): Record<string, string> {
  const c = rgb(accento);
  if (!c) return {};
  const a = hex(c);
  const sopra = inchiostroSopra(a);
  const hover = accentoHover(a, sopra);
  return {
    '--primary': a,
    '--primary-rgb': canali(a)!,
    '--primary-hover': hover,
    '--primary-hover-rgb': canali(hover)!,
    '--on-primary': sopra,
    '--on-primary-rgb': canali(sopra)!,
  };
}

export interface Volto {
  /** Da mettere sull'involucro: `<html data-tema=… data-modo=… style=…>`. */
  attributi: { 'data-tema': IdTema; 'data-modo': Modo };
  stile: Record<string, string>;
  /** Valori d'env scartati: vanno nel log del prodotto, non fermano niente. */
  avvisi: string[];
}

/**
 * Il volto di un'istanza dalle sue env:
 *   BRAND_THEME  id del tema (`acciaio`, `officina`…); vuoto = `diSerie.tema`
 *   BRAND_MODE   `chiaro` | `scuro`, se il tema li ha tutti e due
 *   BRAND_ACCENT `#rrggbb`, l'accento del marchio; vuoto = l'accento del tema
 *   BRAND_BAND   `#rrggbb`, la barra (deroga), solo se scura abbastanza
 * `alias` traduce i valori storici di un prodotto (es. `{ scuro: 'nova' }`) durante l'adozione.
 */
export function voltoDaEnv(
  env: Record<string, string | undefined>,
  diSerie: { tema: IdTema; modo?: Modo },
  alias: Record<string, IdTema> = {},
): Volto {
  const avvisi: string[] = [];
  const chiesto = (env.BRAND_THEME ?? '').trim();
  const tradotto = alias[chiesto] ?? chiesto;
  let tema = diSerie.tema;
  if (tradotto) {
    if (temaValido(tradotto)) tema = tradotto;
    else avvisi.push(`BRAND_THEME «${chiesto}» non è un tema di casa: uso «${diSerie.tema}»`);
  }
  const modo = modoDi(tema, (env.BRAND_MODE ?? '').trim() || diSerie.modo);

  const accento = (env.BRAND_ACCENT ?? '').trim();
  const stile = variabiliAccento(accento);
  if (accento && !Object.keys(stile).length) avvisi.push(`BRAND_ACCENT «${accento}» non è un colore: uso l'accento del tema`);

  const barra = (env.BRAND_BAND ?? '').trim();
  if (barra) {
    const c = contrasto(barra, TESTO_SU_BARRA[`${tema}/${modo}`] ?? '');
    if (c !== null && c >= 4.5) {
      stile['--band'] = hex(rgb(barra)!);
      stile['--band-rgb'] = canali(barra)!;
    } else {
      avvisi.push(`BRAND_BAND «${barra}» non è una barra scura leggibile: uso la barra del tema`);
    }
  }
  return { attributi: { 'data-tema': tema, 'data-modo': modo }, stile, avvisi };
}
