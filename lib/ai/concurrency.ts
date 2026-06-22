/**
 * In-process concurrency limiter for contract analyses (CPERF-2).
 *
 * `POST /api/analyze` launches each analysis fire-and-forget. Without a cap,
 * N simultaneous uploads = N×(chunks×LLM calls) running at once → cost spike,
 * OpenAI 429 rate-limits, and RAM held for every in-flight state. This semaphore
 * bounds how many analyses run their LLM pipeline concurrently; the rest queue
 * in-process and start as slots free up (back-pressure instead of a thundering herd).
 *
 * In-process only: it does NOT coordinate across multiple container replicas.
 * For the standard single-container deploy that is exactly the back-pressure we
 * need; a multi-replica setup would require a shared queue (remediation backlog).
 *
 * @module lib/ai/concurrency
 */

/**
 * Max analyses running their LLM pipeline at the same time. Override via
 * ANALYSIS_MAX_CONCURRENT. Default 2: leaves headroom under OpenAI tier-1 limits
 * while still serving a couple of users without serializing everything.
 */
export const ANALYSIS_MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.ANALYSIS_MAX_CONCURRENT) || 2
);

let active = 0;
const waiters: Array<() => void> = [];

/** Acquire a slot, resolving immediately if one is free or once one frees up. */
function acquire(): Promise<void> {
  if (active < ANALYSIS_MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

/** Release a slot, handing it directly to the next waiter if any. */
function release(): void {
  const next = waiters.shift();
  if (next) {
    // Slot stays "active"; ownership passes to the woken waiter.
    next();
  } else {
    active = Math.max(0, active - 1);
  }
}

/**
 * Run `fn` while holding one of the ANALYSIS_MAX_CONCURRENT slots.
 *
 * @param fn - The work to run under the limiter.
 * @param onQueued - Optional callback fired once, before waiting, only when no
 *   slot is immediately available (e.g. to mark the analysis as queued in the DB).
 */
export async function withAnalysisSlot<T>(
  fn: () => Promise<T>,
  onQueued?: () => void | Promise<void>
): Promise<T> {
  if (active >= ANALYSIS_MAX_CONCURRENT) {
    await onQueued?.();
  }
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
