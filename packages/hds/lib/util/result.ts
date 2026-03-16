export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E; cause?: unknown }

// oxfmt-ignore
export function exception<T, E>(fn: () => Promise<Result<T, E>>): Promise<Result<T, E | 'exception'>>
export function exception<T, E>(fn: () => Result<T, E>): Result<T, E | 'exception'>

// oxfmt-ignore
export function exception<T, E>(fn: () => Result<T, E> | Promise<Result<T, E>>): Result<T, E | 'exception'> | Promise<Result<T, E | 'exception'>> {
  try {
    const result = fn()
    if ('catch' in result && typeof result.catch === 'function') {
      return result.catch((cause) => ({ ok: false, error: 'exception', cause }))
    } else {
      return result
    }
  } catch (cause) {
    return { ok: false, error: 'exception', cause }
  }
}
