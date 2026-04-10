'use client'

import Navbar from '@/components/Navbar'
import BaseModelSelection from '@/components/design-tool/BaseModelSelection'

/**
 * Design tool entry: accessible to everyone (logged in or not).
 * Login is required only when the user clicks "Continue" to create a draft;
 * BaseModelSelection handles that by redirecting to login when needed.
 */
export default function DesignToolRoute() {
  return (
    <div className="design-tool-page-wrapper design-tool-page-wrapper--editor">
      <Navbar />
      <main className="design-tool-main" role="main">
        <BaseModelSelection />
      </main>
    </div>
  )
}
