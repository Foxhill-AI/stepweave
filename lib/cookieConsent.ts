export type CookieCategory = 'essential' | 'analytics' | 'functional' | 'marketing'

export interface ConsentPrefs {
  essential: true
  analytics: boolean
  functional: boolean
  marketing: boolean
  version: number
  ts: number
}

const STORAGE_KEY = 'sw_cookie_consent_v1'
const CURRENT_VERSION = 1
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export const CONSENT_CHANGED_EVENT = 'cookie-consent-changed'
export const OPEN_COOKIE_SETTINGS_EVENT = 'open-cookie-settings'

export function getConsent(): ConsentPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentPrefs
    if (parsed.version !== CURRENT_VERSION) return null
    if (!parsed.ts || Date.now() - parsed.ts > ONE_YEAR_MS) return null
    return { ...parsed, essential: true }
  } catch {
    return null
  }
}

export function hasResponded(): boolean {
  return getConsent() !== null
}

type SettableCategories = Pick<ConsentPrefs, 'analytics' | 'functional' | 'marketing'>

export function setConsent(prefs: SettableCategories): ConsentPrefs {
  const next: ConsentPrefs = {
    essential: true,
    analytics: !!prefs.analytics,
    functional: !!prefs.functional,
    marketing: !!prefs.marketing,
    version: CURRENT_VERSION,
    ts: Date.now(),
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }))
    } catch {
      // localStorage may be unavailable (private mode, quota); fail open without persisting
    }
  }
  return next
}

export function acceptAll(): ConsentPrefs {
  return setConsent({ analytics: true, functional: true, marketing: true })
}

export function rejectNonEssential(): ConsentPrefs {
  return setConsent({ analytics: false, functional: false, marketing: false })
}

export function openCookieSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
  }
}
