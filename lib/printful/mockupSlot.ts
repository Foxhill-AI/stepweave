import type { SupabaseClient } from '@supabase/supabase-js'

/** Returned in JSON when another request holds the Printful mockup slot. */
export const PRINTFUL_SLOT_BUSY_CODE = 'PRINTFUL_SLOT_BUSY'

export type PrintfulMockupSlotAcquire = 'granted' | 'busy' | 'skipped'

/**
 * Try to acquire the global Printful mockup slot (one at a time per database).
 * `skipped` = RPC missing or error — caller should run Printful without locking (fail-open).
 */
export async function tryAcquirePrintfulMockupSlot(
  admin: SupabaseClient,
  holder: string
): Promise<PrintfulMockupSlotAcquire> {
  try {
    const { data, error } = await admin.rpc('printful_mockup_acquire', { p_holder: holder })
    if (error) {
      console.warn('[printful-mockup-slot] acquire rpc:', error.message)
      return 'skipped'
    }
    if (data === true) return 'granted'
    return 'busy'
  } catch (e) {
    console.warn('[printful-mockup-slot] acquire:', e)
    return 'skipped'
  }
}

export async function releasePrintfulMockupSlot(
  admin: SupabaseClient,
  holder: string
): Promise<void> {
  try {
    const { error } = await admin.rpc('printful_mockup_release', { p_holder: holder })
    if (error) console.warn('[printful-mockup-slot] release rpc:', error.message)
  } catch (e) {
    console.warn('[printful-mockup-slot] release:', e)
  }
}
