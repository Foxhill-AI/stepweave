'use client'

export type PatternSource = 'ai' | 'upload'

/** @deprecated use PatternSource */
export type DesignToolMode = PatternSource

interface SourceToggleProps {
  source: PatternSource
  onSourceChange: (source: PatternSource) => void
}

export default function SourceToggle({ source, onSourceChange }: SourceToggleProps) {
  return (
    <div id="design-tool-tabs" className="design-tool-tabs-wrap">
      <div className="design-tool-tabs" role="tablist" aria-label="Pattern source">
        <button
          type="button"
          role="tab"
          aria-selected={source === 'ai'}
          aria-controls="design-tool-left-panel"
          id="tab-ai"
          className="design-tool-tab"
          onClick={() => onSourceChange('ai')}
        >
          ✨ Generate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === 'upload'}
          aria-controls="design-tool-left-panel"
          id="tab-upload"
          className="design-tool-tab"
          onClick={() => onSourceChange('upload')}
        >
          ↑ Upload
        </button>
      </div>
    </div>
  )
}
