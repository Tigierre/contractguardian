/**
 * L'ASPETTO DELL'ISTANZA, dalle env lette a runtime: quale dei temi condivisi di `lib/temi/`
 * (copia senza modifiche: si aggiorna ricopiando i due file, mai a mano) veste l'app, e
 * quale colore hanno le azioni principali.
 *
 *   BRAND_THEME   id di un tema: nova · aurora · neon · sabbia · foresta · officina · acciaio
 *   BRAND_MODE    chiaro | scuro — conta solo per i temi che hanno tutti e due i modi
 *   BRAND_ACCENT  #rrggbb, il colore di marca su `--primary`; il testo sopra (`--on-primary`)
 *                 e l'hover si CALCOLANO per il contrasto, non si scelgono
 *
 * ① Env vuote = nessun attributo e nessuno stile su `<html>`: l'aspetto di serie, identico.
 * ② Un valore sbagliato non ferma la pagina: un avviso nel log (una volta per processo) e si
 *   resta su quello che c'era.
 * ③ Con un tema attivo, `lib/tema-di-casa.css` ridefinisce la palette di Tailwind sui token
 *   del tema e la variante `dark:` si spegne (`app/globals.css`): il modo lo decide il tema,
 *   non la preferenza del sistema né l'interruttore chiaro/scuro.
 * ④ L'accento vale anche senza tema, sull'aspetto di serie.
 *
 * ⛔ Solo lato server: legge le env. Le pagine che lo usano devono essere dinamiche, se no il
 *   valore resta quello del momento della build.
 */
import type { CSSProperties } from 'react';
import { temaValido, voltoDaEnv, TEMI } from '@/lib/temi/temi';

export interface AspettoIstanza {
  /** `data-tema` e `data-modo`, da stendere su `<html>`; vuoto senza un tema valido. */
  attributi: Record<string, string>;
  /** Le variabili dell'accento, per lo `style` di `<html>`; `undefined` senza accento. */
  stile: CSSProperties | undefined;
}

const giaAvvisati = new Set<string>();

function avvisa(messaggio: string): void {
  if (giaAvvisati.has(messaggio)) return;
  giaAvvisati.add(messaggio);
  console.warn(`[tema] ${messaggio}`);
}

export function aspettoIstanza(env: Record<string, string | undefined> = process.env): AspettoIstanza {
  const chiesto = (env.BRAND_THEME ?? '').trim();
  const tema = temaValido(chiesto) ? chiesto : null;
  if (chiesto && !tema) {
    const ids = TEMI.map((t) => t.id).join(', ');
    avvisa(`BRAND_THEME «${chiesto}» non è uno dei temi (${ids}): resta l'aspetto di serie`);
  }

  // Solo le tre env che l'app usa: niente barra (`BRAND_BAND`), l'app non ne ha una.
  const volto = voltoDaEnv(
    { BRAND_THEME: tema ?? '', BRAND_MODE: env.BRAND_MODE, BRAND_ACCENT: env.BRAND_ACCENT },
    { tema: tema ?? 'aurora' },
  );
  volto.avvisi.forEach(avvisa);

  const modoChiesto = (env.BRAND_MODE ?? '').trim();
  if (tema && modoChiesto && modoChiesto !== volto.attributi['data-modo']) {
    avvisa(`BRAND_MODE «${modoChiesto}» non c'è nel tema «${tema}»: uso «${volto.attributi['data-modo']}»`);
  }

  return {
    attributi: tema ? volto.attributi : {},
    stile: Object.keys(volto.stile).length ? (volto.stile as CSSProperties) : undefined,
  };
}
