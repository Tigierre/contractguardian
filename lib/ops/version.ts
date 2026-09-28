/**
 * Quale codice sta girando: il commit da cui è stata costruita l'immagine.
 *
 * Fonti, in ordine: SOURCE_COMMIT (inciso nell'immagine dal Dockerfile, o
 * iniettato dal sistema di deploy), GIT_COMMIT_SHA, RAILWAY_GIT_COMMIT_SHA.
 * Una variabile definita ma vuota, o che non contiene uno SHA (es. "HEAD"),
 * NON oscura la successiva: il Dockerfile definisce sempre SOURCE_COMMIT, anche
 * quando la build non riceve il valore.
 *
 * @module lib/ops/version
 */

const SOURCES = ['SOURCE_COMMIT', 'GIT_COMMIT_SHA', 'RAILWAY_GIT_COMMIT_SHA'] as const;

const SHA = /^[0-9a-f]{7,40}$/i;

/** Valore riportato quando nessuna fonte contiene uno SHA. */
export const UNKNOWN_VERSION = 'sconosciuta';

/** SHA abbreviato a 7 caratteri, oppure UNKNOWN_VERSION. */
export function currentVersion(env: NodeJS.ProcessEnv = process.env): string {
  for (const name of SOURCES) {
    const value = env[name]?.trim();
    if (value && SHA.test(value)) return value.slice(0, 7).toLowerCase();
  }
  return UNKNOWN_VERSION;
}
