'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ModeTabs, { type DesignToolMode } from './ModeTabs'
import AIPromptPanel from './AIPromptPanel'
import ManualEditorPlaceholder from './ManualEditorPlaceholder'
import PreviewWorkspace from './PreviewWorkspace'
import { useAuth } from '@/components/AuthProvider'
import { getCategories, createProduct, updateDesignDraft } from '@/lib/supabaseClient'
import type { CategoryRow, DesignDraftRow } from '@/lib/supabaseClient'
import '../../styles/DesignTool.css'

interface DesignToolPageProps {
  /** When set, we are editing this design draft (from /design-tool/[id]). */
  draftId?: number
  draft?: DesignDraftRow
}

export default function DesignToolPage({ draftId, draft }: DesignToolPageProps) {
  const router = useRouter()
  const { user, userAccount } = useAuth()
  const [mode, setMode] = useState<DesignToolMode>('ai')
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [designData, setDesignData] = useState<Record<string, unknown>>(
    draft?.design_state && typeof draft.design_state === 'object' ? (draft.design_state as Record<string, unknown>) : {}
  )
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  /** Local copy of draft so we can update pattern_image_url after upload without refetch. */
  const [localDraft, setLocalDraft] = useState<DesignDraftRow | null>(draft ?? null)
  /** Resolved signed URL for draft pattern image (when using Storage). */
  const [patternImageSignedUrl, setPatternImageSignedUrl] = useState<string | null>(null)

  const isDraftEditor = Boolean(draftId)

  useEffect(() => {
    setLocalDraft(draft ?? null)
  }, [draft])

  useEffect(() => {
    if (draft?.design_state && typeof draft.design_state === 'object') {
      setDesignData(draft.design_state as Record<string, unknown>)
    }
  }, [draft?.id])

  useEffect(() => {
    let cancelled = false
    getCategories().then((rows) => {
      if (!cancelled) setCategories(rows)
    })
    return () => { cancelled = true }
  }, [])

  // Fetch signed URL when draft has a pattern stored in Storage (private bucket).
  useEffect(() => {
    const path = localDraft?.pattern_image_url
    if (!draftId || !path || typeof path !== 'string' || path.trim() === '') {
      setPatternImageSignedUrl(null)
      return
    }
    let cancelled = false
    fetch(`/api/design-drafts/${draftId}/pattern-image`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load image'))))
      .then((body: { url?: string }) => {
        if (!cancelled && body.url) setPatternImageSignedUrl(body.url)
      })
      .catch(() => {
        if (!cancelled) setPatternImageSignedUrl(null)
      })
    return () => { cancelled = true }
  }, [draftId, localDraft?.pattern_image_url])

  const handlePatternUploaded = useCallback(
    async (path: string) => {
      if (!draftId) return
      const ok = await updateDesignDraft(draftId, {
        pattern_image_url: path,
        pattern_source_type: 'direct_upload',
      })
      if (ok)
        setLocalDraft((prev) =>
          prev ? { ...prev, pattern_image_url: path, pattern_source_type: 'direct_upload' } : null
        )
    },
    [draftId]
  )

  const handlePatternClear = useCallback(async () => {
    if (!draftId) return
    await updateDesignDraft(draftId, { pattern_image_url: null })
    setLocalDraft((prev) => (prev ? { ...prev, pattern_image_url: null } : null))
    setDesignData((prev) => {
      const next = { ...prev }
      delete next.imageUrl
      return next
    })
  }, [draftId])

  const handleSaveDraft = useCallback(async () => {
    if (!draftId) return
    setCreateError(null)
    setCreateLoading(true)
    try {
      const ok = await updateDesignDraft(draftId, { design_state: designData })
      if (ok) {
        setCreateError(null)
      } else {
        setCreateError('Failed to save draft. Please try again.')
      }
    } catch {
      setCreateError('Something went wrong. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }, [draftId, designData])

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
            {isDraftEditor ? (
              <>
                <h3 className="design-tool-form-title">Save your design</h3>
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
                    onClick={handleSaveDraft}
                  >
                    {createLoading ? 'Saving…' : 'Save as Draft'}
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>
        <section
          className="design-tool-right"
          aria-label={mode === 'ai' ? 'Preview' : 'Design preview'}
          role="region"
        >
          <PreviewWorkspace
            mode={mode}
            draftId={draftId}
            authUserId={user?.id ?? null}
            onImageSelect={(url) => setDesignData((prev) => ({ ...prev, imageUrl: url }))}
            onPatternUploaded={handlePatternUploaded}
            onImageClear={() => {
              if (localDraft?.pattern_image_url) {
                handlePatternClear()
              } else {
                setDesignData((prev) => {
                  const next = { ...prev }
                  delete next.imageUrl
                  return next
                })
              }
            }}
            imageUrl={
              localDraft?.pattern_image_url
                ? patternImageSignedUrl ?? undefined
                : typeof designData.imageUrl === 'string'
                  ? designData.imageUrl
                  : null
            }
          />
        </section>
      </div>
    </div>
  )
}
