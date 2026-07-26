'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import BaseModelSelection from '@/components/design-tool/BaseModelSelection'
import { useAuth } from '@/components/AuthProvider'
import { setAuthReturnTo } from '@/lib/authReturnTo'

/**
 * /design-tool/new — shoe model selection (start of new design flow).
 */
function DesignToolNewInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    if (user) return
    setAuthReturnTo('/design-tool/new')
    if (searchParams.get('openAuth') !== '1') {
      router.replace('/design-tool/new?openAuth=1')
    }
  }, [authLoading, user, router, searchParams])

  return (
    <main className="design-tool-main" role="main">
      <BaseModelSelection />
    </main>
  )
}

export default function DesignToolNewRoute() {
  return (
    <div className="design-tool-page-wrapper design-tool-page-wrapper--slim-nav">
      <Navbar />
      <Suspense
        fallback={
          <main className="design-tool-main" role="main">
            <p className="design-tool-loading" aria-live="polite">
              Loading…
            </p>
          </main>
        }
      >
        <DesignToolNewInner />
      </Suspense>
    </div>
  )
}
