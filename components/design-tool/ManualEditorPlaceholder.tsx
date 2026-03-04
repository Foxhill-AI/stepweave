'use client'

import { useState } from 'react'
import {
  Package,
  Upload,
  Type,
  Image,
  Sparkles,
  Grid3X3,
  HelpCircle,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'product', label: 'Product', icon: Package },
  { id: 'uploads', label: 'Uploads', icon: Upload },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'saved', label: 'Saved designs', icon: Image },
  { id: 'clipart', label: 'Clipart', icon: Sparkles },
  { id: 'quick', label: 'Quick Designs', icon: Grid3X3 },
  { id: 'help', label: 'Help', icon: HelpCircle },
] as const

const COLOR_SWATCHES = [
  '#1a1a1a',
  '#1e3a5f',
  '#c41e3a',
  '#2d5016',
  '#5c4033',
  '#c4a574',
  '#f0b4c2',
  '#87ceeb',
  '#f5f5f0',
]

export default function ManualEditorPlaceholder() {
  const [activeSidebar, setActiveSidebar] = useState<string>(SIDEBAR_ITEMS[0].id)
  const [technique, setTechnique] = useState<'standard' | 'premium'>('standard')
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0)

  return (
    <div className="manual-editor">
      <nav
        className="manual-sidebar"
        role="navigation"
        aria-label="Design tools"
      >
        {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`manual-sidebar-item ${activeSidebar === id ? 'manual-sidebar-item--active' : ''}`}
            onClick={() => setActiveSidebar(id)}
            aria-pressed={activeSidebar === id}
            aria-label={label}
          >
            <Icon size={20} aria-hidden />
            <span className="manual-sidebar-label">{label}</span>
          </button>
        ))}
      </nav>
      <div className="manual-properties">
        <h3 className="manual-property-title">Product name</h3>
        <p className="manual-property-subtitle">Style &amp; variant (placeholder)</p>
        <div className="manual-property-section">
          <span className="manual-property-label">Technique</span>
          <div className="manual-property-pills">
            <button
              type="button"
              className={`manual-pill ${technique === 'standard' ? 'manual-pill--active' : ''}`}
              onClick={() => setTechnique('standard')}
              aria-pressed={technique === 'standard'}
            >
              Standard
            </button>
            <button
              type="button"
              className={`manual-pill ${technique === 'premium' ? 'manual-pill--active' : ''}`}
              onClick={() => setTechnique('premium')}
              aria-pressed={technique === 'premium'}
            >
              Premium
            </button>
          </div>
        </div>
        <div className="manual-property-section">
          <span className="manual-property-label">Color option</span>
          <div className="manual-property-radios">
            <label className="manual-radio">
              <input type="radio" name="color-option" defaultChecked />
              <span>Standard</span>
            </label>
            <label className="manual-radio">
              <input type="radio" name="color-option" />
              <span>Unlimited color</span>
            </label>
          </div>
        </div>
        <div className="manual-property-section">
          <span className="manual-property-label">Product color</span>
          <div className="manual-color-swatches">
            {COLOR_SWATCHES.map((hex, i) => (
              <button
                key={i}
                type="button"
                className={`manual-swatch ${selectedColorIndex === i ? 'manual-swatch--active' : ''}`}
                style={{ backgroundColor: hex }}
                aria-label={`Color ${i + 1}`}
                title={hex}
                onClick={() => setSelectedColorIndex(i)}
                aria-pressed={selectedColorIndex === i}
              />
            ))}
          </div>
        </div>
        <div className="manual-property-section">
          <span className="manual-property-label">Size</span>
          <p className="manual-property-value">One size fits all</p>
        </div>
      </div>
    </div>
  )
}
