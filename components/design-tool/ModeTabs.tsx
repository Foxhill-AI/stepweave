'use client'

export type DesignToolMode = 'ai' | 'manual'

interface ModeTabsProps {
  mode: DesignToolMode
  onModeChange: (mode: DesignToolMode) => void
}

export default function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div id="design-tool-tabs" className="design-tool-tabs-wrap">
      <div className="design-tool-tabs" role="tablist" aria-label="Design mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ai'}
          aria-controls="design-tool-left-panel"
          id="tab-ai"
          className="design-tool-tab"
          onClick={() => onModeChange('ai')}
        >
          AI Design
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          aria-controls="design-tool-left-panel"
          id="tab-manual"
          className="design-tool-tab"
          onClick={() => onModeChange('manual')}
        >
          Manual
        </button>
      </div>
    </div>
  )
}
