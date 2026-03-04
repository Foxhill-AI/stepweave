'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DebugAuth() {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DebugAuth] onAuthStateChange:', event, session)
    })

    const run = async () => {
      const { data } = await supabase.auth.getSession()
      console.log('[DebugAuth] getSession:', data.session)
    }
    run()

    return () => sub.subscription.unsubscribe()
  }, [])

  return null
}
