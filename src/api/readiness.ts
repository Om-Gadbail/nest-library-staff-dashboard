/**
 * Backend readiness / Render free cold-start handling (dashboard copy).
 *
 * Render Free sleeps after inactivity. The first request while the backend
 * is waking manifests as a network failure (no response), a timeout, or an
 * edge 502/503/504 - NOT an auth failure. The UI must not show a terminal
 * "Network unavailable" immediately; it retries with bounded exponential
 * backoff, preserves user input, and continues normally once the backend
 * answers.
 *
 * Safety: bounded retries only (no infinite loops, no request storms);
 * automatic retry covers idempotent GETs plus the login/refresh exchange
 * only. Mutating POST/PATCH/PUT/DELETE are never auto-retried (no duplicate
 * payments/leads/bookings/memberships). No auth/CORS weakening, no secrets.
 */

export const WAKING_MESSAGE =
  'Backend is waking up. Retrying automatically - your entries are kept.';

export const EXHAUSTED_MESSAGE =
  'Backend is still waking up. Wait a moment and try again - your entries were kept.';

/** Statuses that mean "backend/edge temporarily unavailable", worth a retry. */
export function isColdStartStatus(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504 || status === 408;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bounded exponential backoff with a small jitter (no thundering herd). */
export function coldStartDelay(attempt: number, baseMs = 1000): number {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(exp, 10_000) + Math.floor(Math.random() * 250);
}

/** Derive the liveness URL from an API base (strips a trailing /api/v1). */
export function healthUrlFromApiBase(apiBase: string): string {
  return apiBase.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '') + '/health';
}

/** True when an axios-shaped failure looks like a cold start (retryable). */
export function isColdStartAxiosError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as {
    response?: { status?: unknown };
    code?: unknown;
    message?: unknown;
  };
  const status = rec.response?.status;
  if (typeof status === 'number' && isColdStartStatus(status)) return true;
  if (rec.response) return false;
  if (rec.code === 'ERR_NETWORK' || rec.code === 'ECONNABORTED' || rec.code === 'ETIMEDOUT')
    return true;
  if (typeof rec.message === 'string' && /network error|failed to fetch|timeout/i.test(rec.message))
    return true;
  return false;
}

/** True when a shaped ApiError looks like a cold start (retryable). */
export function isColdStartError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { kind?: unknown; status?: unknown };
  if (typeof rec.status === 'number' && isColdStartStatus(rec.status)) return true;
  return rec.kind === 'network' || rec.kind === 'unavailable';
}

export interface BackendReadyResult {
  ok: boolean;
  attempts: number;
  lastStatus?: number;
}

/**
 * Poll GET /health until 200 or the attempt budget is spent.
 * Resolves (never rejects): callers branch on `ok`.
 */
export async function waitForBackendReady(
  apiBase: string,
  opts: { attempts?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<BackendReadyResult> {
  const maxAttempts = opts.attempts ?? 6;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const url = healthUrlFromApiBase(apiBase);
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      lastStatus = res.status;
      if (res.status === 200) return { ok: true, attempts: attempt, lastStatus };
    } catch {
      lastStatus = undefined;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) await sleep(coldStartDelay(attempt, baseDelayMs));
  }
  return { ok: false, attempts: maxAttempts, lastStatus };
}
