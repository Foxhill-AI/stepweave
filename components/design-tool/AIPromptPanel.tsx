'use client'

import { useState } from 'react'
import { Paperclip } from 'lucide-react'

const MOCK_MESSAGES = [
  { id: '1', role: 'user' as const, text: 'A minimal logo for a ... company' },
  { id: '2', role: 'assistant' as const, text: 'Your design will appear in the preview when you generate.' },
]

export default function AIPromptPanel() {
  const [prompt, setPrompt] = useState('')

  const handleClear = () => {
    setPrompt('')
  }

  return (
    <div className="ai-prompt-panel">
      <div className="ai-prompt-messages" aria-label="Chat messages">
        <div className="ai-prompt-message placeholder">
          Describe your design. Results will show in the preview.
        </div>
        {MOCK_MESSAGES.map((msg) => (
          <div key={msg.id} className={`ai-prompt-message ${msg.role}`} role="article">
            {msg.text}
          </div>
        ))}
      </div>

      <div className="ai-prompt-input-wrap">
        <div className="ai-prompt-attach-row">
          <button type="button" className="ai-prompt-attach-btn" aria-label="Attach file (UI only)">
            <Paperclip size={18} aria-hidden />
            Attach
          </button>
          <span className="ai-prompt-attach-hint">or drag files here</span>
        </div>
        <label htmlFor="ai-prompt-input" className="sr-only">
          Design prompt
        </label>
        <textarea
          id="ai-prompt-input"
          className="ai-prompt-input"
          placeholder="Describe what you want to create…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          aria-label="Design prompt"
        />
        <div className="ai-prompt-actions">
          <button type="button" className="ai-prompt-btn primary">
            Generate
          </button>
          <button type="button" className="ai-prompt-btn secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
