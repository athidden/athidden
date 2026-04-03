/** Rust-style `Result<T, E>` discriminated union. */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E; readonly cause?: unknown }

export namespace Result {
  /** Wraps `value` in a success variant. */
  export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value }
  }

  /** Wraps `error` in a failure variant, `cause` is preserved for error chaining. */
  export function err<E>(error: E, cause?: unknown): Result<never, E> {
    if (cause) {
      return { ok: false, error, cause }
    } else {
      return { ok: false, error }
    }
  }

  /** Applies `fn` to the `value`; passes errors through. */
  export function map<T, E, U>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return r.ok ? ok(fn(r.value)) : r
  }

  /** Applies `fn` to the `error`; the original result becomes the new `cause`. */
  export function mapErr<T, E, F>(r: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return r.ok ? r : err(fn(r.error), r)
  }

  /** Unwraps the `value` or throws. Sets `Error.cause` to the first `Error` found in the chain. */
  export function get<T>(r: Result<T, unknown>): T {
    if (r.ok) return r.value
    const cause = resultError(r)
    throw cause ? new Error(resultStr(r), { cause }) : new Error(resultStr(r))
  }

  /** Calls `fn` and returns a `Result`, catching errors. */
  export function catches<T>(fn: () => T): Result<T, unknown> {
    try {
      return ok(fn())
    } catch (e) {
      return err(e)
    }
  }

  /** Returns a string representation of the result. */
  export function toString(r: Result<unknown, unknown>): string {
    return resultStr(r)
  }
}

type R = Result<unknown, unknown>

const isResult = (v: any): v is R =>
  v != null &&
  typeof v === 'object' &&
  typeof v.ok === 'boolean' &&
  (v.ok ? 'value' in v : 'error' in v)

function fieldStr(v: any): string {
  return isResult(v) ? resultStr(v) : String(v?.message || v)
}

function resultStr(r: R): string {
  if (r.ok) return 'ok'
  const { error, cause } = r
  if (error && cause) return `${fieldStr(error)}: ${fieldStr(cause)}`
  if (error) return fieldStr(error)
  if (cause) return fieldStr(cause)
  return 'unknown error'
}

function resultError(r: R): Error | undefined {
  if (r.ok) return undefined
  const { error, cause } = r
  if (error instanceof Error) return error
  if (cause instanceof Error) return cause
  return isResult(cause) ? resultError(cause) : undefined
}
