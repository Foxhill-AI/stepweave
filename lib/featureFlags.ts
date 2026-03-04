/**
 * Feature flags for optional modules.
 * Tables exist in the schema; flags control whether the UI/backend expose the feature.
 * Toggle via env vars (build/deploy) or extend to read from DB for admin UI control.
 */

export const FEATURE_KEYS = {
    NEWSLETTER: 'newsletter',
    BLOG: 'blog',
    CONTACT: 'contact',
    SUBSCRIPTIONS: 'subscriptions',
  } as const
  
  export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]
  
  const envFlags: Record<FeatureKey, string> = {
    [FEATURE_KEYS.NEWSLETTER]: process.env.NEXT_PUBLIC_FEATURE_NEWSLETTER ?? '',
    [FEATURE_KEYS.BLOG]: process.env.NEXT_PUBLIC_FEATURE_BLOG ?? '',
    [FEATURE_KEYS.CONTACT]: process.env.NEXT_PUBLIC_FEATURE_CONTACT ?? '',
    [FEATURE_KEYS.SUBSCRIPTIONS]: process.env.NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS ?? '',
  }
  
  function isEnabled(envValue: string): boolean {
    return envValue === 'true' || envValue === '1'
  }
  
  /**
   * Check if a feature is enabled (client or server).
   */
  export function isFeatureEnabled(key: FeatureKey): boolean {
    return isEnabled(envFlags[key])
  }
  
  /**
   * Get all feature flags (e.g. for admin UI or debugging).
   */
  export function getFeatureFlags(): Record<FeatureKey, boolean> {
    return {
      [FEATURE_KEYS.NEWSLETTER]: isEnabled(envFlags[FEATURE_KEYS.NEWSLETTER]),
      [FEATURE_KEYS.BLOG]: isEnabled(envFlags[FEATURE_KEYS.BLOG]),
      [FEATURE_KEYS.CONTACT]: isEnabled(envFlags[FEATURE_KEYS.CONTACT]),
      [FEATURE_KEYS.SUBSCRIPTIONS]: isEnabled(envFlags[FEATURE_KEYS.SUBSCRIPTIONS]),
    }
  }