/**
 * Generic retry helper for fetch-style operations.
 *
 * Defaults match the user's spec: up to 5 attempts, each capped at 60 s,
 * stop on clear business errors (4xx other than 408/429), retry on
 * network errors / timeouts / 5xx / 408 / 429.
 *
 * `withRetry` keeps the abort semantics clean — the parent signal can
 * cancel the whole operation; each attempt has its own AbortController
 * that enforces the per-attempt timeout.
 */

export interface RetryInfo {
  /** 1-based attempt number that is about to start (so the UI can say "重试 2/5") */
  attempt: number
  total: number
  /** Human-readable reason for the previous failure */
  reason: string
}

export interface RetryOptions {
  maxAttempts?: number
  perAttemptTimeoutMs?: number
  /** Outer abort signal — if it triggers we stop immediately. */
  signal?: AbortSignal
  /** Called just before each retry (not before the first attempt). */
  onRetry?: (info: RetryInfo) => void
  /** Override the default policy. Return true to retry the given error. */
  shouldRetry?: (error: unknown) => boolean
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`请求超时（${Math.round(timeoutMs / 1000)} 秒未响应）`)
    this.name = 'TimeoutError'
  }
}

/** Status codes that signal a transient condition worth retrying. */
export function isTransientStatus(status: number): boolean {
  if (status === 408 || status === 429) return true
  if (status >= 500 && status < 600) return true
  return false
}

/** Pick out a numeric HTTP status from an unknown error shape (ApiError / FetchResponse / etc.) */
function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const s = (error as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}

export function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof TimeoutError) return true
  const status = getStatus(error)
  if (typeof status === 'number') return isTransientStatus(status)
  // Fetch network failures throw a TypeError ("Failed to fetch"). Treat as transient.
  if (error instanceof TypeError) return true
  // Generic AbortError surfaces here when a parent signal triggers — that should
  // bubble up; the caller's signal-aborted check handles it.
  return false
}

function describeError(e: unknown): string {
  if (e instanceof TimeoutError) return '请求超时'
  const status = getStatus(e)
  if (status) {
    const msg = (e as { message?: string }).message || ''
    const head = msg.split(/[:：]\s/, 2)[0]
    return `HTTP ${status}${head && head.length < 60 ? ` · ${head}` : ''}`
  }
  if (e instanceof TypeError) return `网络错误：${e.message}`.slice(0, 80)
  const m = (e as { message?: string })?.message
  return (m || String(e)).slice(0, 80)
}

/**
 * Run `fn` with retry/timeout semantics.
 *
 * `fn` receives an AbortSignal that will fire either when the per-attempt
 * timeout expires (the signal's `reason` is a `TimeoutError` in that case) or
 * when the parent `signal` aborts. `fn` should pass this signal to its
 * underlying fetch call.
 */
export async function withRetry<T>(
  fn: (attemptSignal: AbortSignal, attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 5,
    perAttemptTimeoutMs = 60_000,
    signal,
    onRetry,
    shouldRetry = defaultShouldRetry,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    }

    const controller = new AbortController()
    const timeoutErr = new TimeoutError(perAttemptTimeoutMs)
    const timer = setTimeout(() => controller.abort(timeoutErr), perAttemptTimeoutMs)
    const onParentAbort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', onParentAbort, { once: true })

    try {
      return await fn(controller.signal, attempt)
    } catch (err) {
      lastError = err
      if (signal?.aborted) throw err

      // Normalize: a fetch that aborted due to our timeout should surface as TimeoutError.
      const isTimeout =
        controller.signal.aborted && controller.signal.reason instanceof TimeoutError
      const effectiveError = isTimeout ? timeoutErr : err

      if (attempt >= maxAttempts || !shouldRetry(effectiveError)) {
        throw effectiveError
      }

      onRetry?.({
        attempt: attempt + 1,
        total: maxAttempts,
        reason: describeError(effectiveError),
      })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onParentAbort)
    }
  }
  throw lastError
}
