'use client'

import Navbar from '@/components/Navbar'
import BaseModelSelection from '@/components/design-tool/BaseModelSelection'

/**
 * /design-tool/new — shoe model selection (start of new design flow).
 */
export default function DesignToolNewRoute() {
  return (
    <div className="design-tool-page-wrapper design-tool-page-wrapper--slim-nav">
      <Navbar />
      <main className="design-tool-main" role="main">
        <BaseModelSelection />
      </main>
    </div>
  )
}
