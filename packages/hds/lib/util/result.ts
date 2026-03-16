export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E; readonly cause?: unknown }

export namespace Result {
  /** Wraps a plain value in an `{ ok: true, value }` result. */
  export const ok = <T>(value: T): Result<T, never> => {
    return { ok: true, value }
  }

  /** Wraps an error in an `{ ok: false, error }` result. */
  export const err = <E>(error: E, cause?: unknown): Result<never, E> => {
    if (cause) {
      return { ok: false, error, cause }
    } else {
      return { ok: false, error }
    }
  }

  /** Returns `true` if the value is a `Result`-like object. */
  export function isResult(result: any): result is Result<unknown, unknown> {
    if (typeof result !== 'object' || result === null) return false
    if (typeof result?.ok !== 'boolean') return false
    return result.ok ? 'value' in result : 'error' in result
  }

  /** Returns the result as a message string. */
  export function toString(result: Result<unknown, unknown>): string {
    if (result.ok) {
      return 'ok'
    } else {
      const { error, cause } = result as { error: any; cause: any }
      const errorMessage = error?.message || String(error)
      const causeMessage = cause?.message || String(cause)
      if (cause != null) {
        return `${errorMessage}: ${causeMessage}`
      } else {
        return errorMessage
      }
    }
  }

  /** Represents a failed result as a JS `Error`. */
  export class ResultError extends Error {
    /** The result that failed. */
    result: Result<unknown, unknown>

    constructor(result: Result<unknown, unknown>, options?: ErrorOptions) {
      super(toString(result), options)
      this.result = result
    }
  }

  /** Unwraps a result, throwing on error. */
  export function unwrap<T>(result: Result<T, unknown>): T {
    if (result.ok) return result.value
    const { error, cause } = result
    if (error instanceof Error) throw error
    if (cause instanceof Error) {
      throw new ResultError(result, { cause })
    } else {
      throw new ResultError(result)
    }
  }

  /** Unwraps a result, returning a default value on error. */
  export function unwrapOr<T>(result: Result<T, unknown>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue
  }

  /** Maps the result's value to a different value, preserving the error. */
  export function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? ok(fn(result.value)) : result
  }

  /** Converts a failed result to a cause (error or string) for another result. */
  function toCause<T, E>(result: Result<T, E>): unknown {
    if (result.ok) return undefined
    if (result.error instanceof Error) return result.error
    if (result.cause instanceof Error) return result.cause
    return toString(result)
  }

  /** Maps the result's error tag to a different one, preserving the cause. */
  export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : err(fn(result.error), toCause(result))
  }

  /** Retags a result using a mapping between old tags and new tags, preserving the cause. */
  export function retagErr<T, E extends string, From extends E, To extends string>(
    result: Result<T, E>,
    tags: Record<From, To>,
  ): Result<T, Exclude<E, From> | To> {
    if (result.ok) return result
    const tag = tags[result.error as From]
    return tag != null ? err(tag, toCause(result)) : (result as any)
  }

  /** Maps the result's value to a different value, merging errors. */
  export function flatMap<T, E, U, F>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, F>,
  ): Result<U, E | F> {
    if (!result.ok) return result
    return fn(result.value)
  }

  /** Maps the result's value to a different value, merging errors. */
  export async function flatMapAsync<T, E, U, F>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, F>>,
  ): Promise<Result<U, E | F>> {
    if (!result.ok) return result
    return fn(result.value)
  }
}
