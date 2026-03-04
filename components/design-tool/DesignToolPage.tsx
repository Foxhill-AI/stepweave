'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ModeTabs, { type DesignToolMode } from './ModeTabs'
import AIPromptPanel from './AIPromptPanel'
import ManualEditorPlaceholder from './ManualEditorPlaceholder'
import PreviewWorkspace from './PreviewWorkspace'
import { useAuth } from '@/components/AuthProvider'
import { getCategories, createProduct } from '@/lib/supabaseClient'
import type { CategoryRow } from '@/lib/supabaseClient'
import '../../styles/DesignTool.css'

export default function DesignToolPage() {
  const router = useRouter()
  const { userAccount } = useAuth()
  const [mode, setMode] = useState<DesignToolMode>('ai')
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [designData, setDesignData] = useState<Record<string, unknown>>({})
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCategories().then((rows) => {
      if (!cancelled) setCategories(rows)
    })
    return () => { cancelled = true }
  }, [])

  const handleCreate = useCallback(
    async (status: 'draft' | 'active') => {
      if (!userAccount?.id) {
        setCreateError('You must be signed in to create a product.')
        return
      }
      const trimmedName = name.trim()
      if (!trimmedName) {
        setCreateError('Please enter a product name.')
        return
      }
      const priceNum = parseFloat(price)
      if (Number.isNaN(priceNum) || priceNum < 0) {
        setCreateError('Please enter a valid price (0 or greater).')
        return
      }
      setCreateError(null)
      setCreateLoading(true)
      try {
        const result = await createProduct(userAccount.id, {
          name: trimmedName,
          price: priceNum,
          status,
          design_data: Object.keys(designData).length ? designData : null,
          categoryIds: categoryId !== '' ? [categoryId as number] : [],
        })
        if (result) {
          router.push('/profile')
        } else {
          setCreateError('Failed to create product. Please try again.')
        }
      } catch {
        setCreateError('Something went wrong. Please try again.')
      } finally {
        setCreateLoading(false)
      }
    },
    [userAccount?.id, name, price, categoryId, designData, router]
  )

  return (
    <div className="design-tool-page">
      <div className="design-tool-layout">
        <section
          className={`design-tool-left ${mode === 'manual' ? 'design-tool-left--manual' : ''}`}
          id="design-tool-left-panel"
          aria-labelledby="design-tool-tabs"
          role="region"
        >
          <ModeTabs mode={mode} onModeChange={setMode} />
          <div className="design-tool-panel-content">
            {mode === 'ai' ? <AIPromptPanel /> : <ManualEditorPlaceholder />}
          </div>
          <div className="design-tool-product-form">
            <h3 className="design-tool-form-title">Product details</h3>
            <label htmlFor="design-tool-name" className="design-tool-label">
              Name
            </label>
            <input
              id="design-tool-name"
              type="text"
              className="design-tool-input"
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-required
            />
            <label htmlFor="design-tool-price" className="design-tool-label">
              Price ($)
            </label>
            <input
              id="design-tool-price"
              type="number"
              min={0}
              step={0.01}
              className="design-tool-input"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-required
            />
            <label htmlFor="design-tool-category" className="design-tool-label">
              Category
            </label>
            <select
              id="design-tool-category"
              className="design-tool-select"
              value={categoryId === '' ? '' : String(categoryId)}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {createError && (
              <p className="design-tool-form-error" role="alert">
                {createError}
              </p>
            )}
            <div className="design-tool-form-actions">
              <button
                type="button"
                className="design-tool-btn design-tool-btn-draft"
                disabled={createLoading}
                onClick={() => handleCreate('draft')}
              >
                {createLoading ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                className="design-tool-btn design-tool-btn-publish"
                disabled={createLoading}
                onClick={() => handleCreate('active')}
              >
                {createLoading ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </section>
        <section
          className="design-tool-right"
          aria-label={mode === 'ai' ? 'Preview' : 'Design preview'}
          role="region"
        >
          <PreviewWorkspace
            mode={mode}
            onImageSelect={(url) => setDesignData((prev) => ({ ...prev, imageUrl: url }))}
            imageUrl={typeof designData.imageUrl === 'string' ? designData.imageUrl : null}
            onImageClear={() => setDesignData((prev) => {
              const next = { ...prev }
              delete next.imageUrl
              return next
            })}
          />
        </section>
      </div>
    </div>
  )
}
