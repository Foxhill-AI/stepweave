'use client'

import Link from 'next/link'
import { Pencil, FolderOpen } from 'lucide-react'
import Navbar from '@/components/Navbar'
import '../../styles/DesignTool.css'

export default function DesignToolHubRoute() {
  return (
    <div className="design-tool-page-wrapper">
      <Navbar />
      <main className="design-tool-main dt-hub-main" role="main">
        <div className="dt-hub-hero">
          <h1 className="dt-hub-title">Design Tool</h1>
          <p className="dt-hub-subtitle">
            Create a new custom shoe design or pick up where you left off.
          </p>
        </div>
        <div className="dt-hub-options">
          <Link href="/design-tool/new" className="dt-hub-option-card">
            <Pencil size={32} strokeWidth={1.5} className="dt-hub-option-icon" aria-hidden />
            <span className="dt-hub-option-title">Start new design</span>
            <span className="dt-hub-option-desc">Choose a shoe model and start fresh</span>
          </Link>
          <Link href="/design-tool/drafts" className="dt-hub-option-card">
            <FolderOpen size={32} strokeWidth={1.5} className="dt-hub-option-icon" aria-hidden />
            <span className="dt-hub-option-title">My drafts</span>
            <span className="dt-hub-option-desc">Continue working on a saved design</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
