/**
 * Where to send the user after a successful login / signup / OAuth callback.
 * Only same-origin relative paths are allowed.
 */

const AUTH_RETURN_TO_KEY = 'auth-return-to'

function sanitizeReturnPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (trimmed.startsWith('/auth')) return null
  return trimmed
}

export function setAuthReturnTo(path: string, options?: { onlyIfEmpty?: boolean }): void {
  if (typeof window === 'undefined') return
  const safe = sanitizeReturnPath(path)
  if (!safe) return
  try {
    if (options?.onlyIfEmpty && sessionStorage.getItem(AUTH_RETURN_TO_KEY)) return
    sessionStorage.setItem(AUTH_RETURN_TO_KEY, safe)
  } catch {
    // ignore quota / private mode
  }
}

/** Read and clear the stored return path. */
export function consumeAuthReturnTo(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(AUTH_RETURN_TO_KEY)
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY)
    return sanitizeReturnPath(raw) ?? fallback
  } catch {
    return fallback
  }
}

export function peekAuthReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sanitizeReturnPath(sessionStorage.getItem(AUTH_RETURN_TO_KEY))
  } catch {
    return null
  }
}
