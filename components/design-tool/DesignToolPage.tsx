'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ModeTabs, { type DesignToolMode } from './ModeTabs'
import AIPromptPanel from './AIPromptPanel'
import ManualEditorPlaceholder from './ManualEditorPlaceholder'
import PlacementEditorPanel from './PlacementEditorPanel'
import PreviewWorkspace, { type PlacementTab } from './PreviewWorkspace'
import {
  mergePrintfulPlacementsIntoDesignState,
  parsePrintfulPlacements,
  type PrintfulPlacementsState,
} from '@/lib/designDraftState'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
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
  /** Mockup URL per Printful placement (same variant). */
  const [placementMockups, setPlacementMockups] = useState<PlacementTab[]>([])
  const [catalogFallbackUrl, setCatalogFallbackUrl] = useState<string>('')
  const [variantOptions, setVariantOptions] = useState<
    Array<{ id: number; name: string; color: string; size: string; image: string }>
  >([])
  const [printfulVariantId, setPrintfulVariantId] = useState<number | null>(null)
  /** Name of the currently selected shoe model (e.g. "Men's Athletic Shoes"). */
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null)
  /** True while Mockup Generator is producing per-placement reference images. */
  const [mockupImagesLoading, setMockupImagesLoading] = useState(false)
  /** Printful did not return mockup URLs; preview uses catalog images per tab. */
  const [mockupCatalogOnly, setMockupCatalogOnly] = useState(false)
  /** True after the user has explicitly generated at least one preview. */
  const [hasGeneratedMockups, setHasGeneratedMockups] = useState(false)
  /** POST /preview-mockups (user pattern + design_state positions). */
  const [printfulPreviewLoading, setPrintfulPreviewLoading] = useState(false)
  const [placementSaveLoading, setPlacementSaveLoading] = useState(false)
  // Lifted template state — shared between PlacementEditorPanel (controls) and PreviewWorkspace (canvas)
  const [templateRows, setTemplateRows] = useState<PlacementTemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [activePlacement, setActivePlacement] = useState<string>('')

  const designDataRef = useRef(designData)
  designDataRef.current = designData
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)

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

  // Load product info: name, variants, catalog fallback image.
  // Mockup generation is NOT triggered automatically — user clicks "See preview" instead.
  useEffect(() => {
    const baseModelId = localDraft?.base_model_id
    if (!baseModelId || typeof baseModelId !== 'string' || baseModelId.trim() === '') {
      setPlacementMockups([])
      setMockupCatalogOnly(false)
      setCatalogFallbackUrl('')
      setVariantOptions([])
      setPrintfulVariantId(null)
      setSelectedModelName(null)
      setMockupImagesLoading(false)
      return
    }
    let cancelled = false
    // Clear stale mockups and reset generation state when model/color changes
    setPlacementMockups([])
    setHasGeneratedMockups(false)

    const pid = baseModelId.trim()
    const storedVid = designData.printful_variant_id
    const parsedStored =
      typeof storedVid === 'number'
        ? storedVid
        : typeof storedVid === 'string' && /^\d+$/.test(storedVid)
          ? parseInt(storedVid, 10)
          : NaN

    fetch(`/api/printful/products/${encodeURIComponent(pid)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('product'))))
      .then(
        (productBody: {
          name?: string
          image?: string
          variants?: Array<{
            id: number
            name: string
            color: string
            size: string
            image: string
          }>
        }) => {
          if (cancelled) return
          setSelectedModelName(productBody.name ?? null)
          const variants = productBody.variants ?? []
          setVariantOptions(variants)

          let vid: number | null = null
          if (Number.isFinite(parsedStored) && variants.some((v) => v.id === parsedStored)) {
            vid = parsedStored
          } else {
            const want =
              (localDraft?.structural_color ?? 'white').toLowerCase() === 'black'
                ? 'black'
                : 'white'
            const match = variants.find((v) => (v.color ?? '').toLowerCase() === want)
            vid = match?.id ?? variants[0]?.id ?? null
          }
          if (vid == null) {
            setCatalogFallbackUrl((productBody.image ?? '').trim())
            return
          }
          setPrintfulVariantId(vid)
          const vrow = variants.find((v) => v.id === vid)
          setCatalogFallbackUrl(((vrow?.image || productBody.image) ?? '').trim())
        }
      )
      .catch(() => {
        if (!cancelled) setMockupCatalogOnly(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    localDraft?.base_model_id,
    localDraft?.structural_color,
    designData.printful_variant_id,
  ])

  // Fetch Printful placement templates lifted to page level so both panel and canvas share them
  useEffect(() => {
    const pid = typeof localDraft?.base_model_id === 'string' ? localDraft.base_model_id.trim() : ''
    if (!pid || printfulVariantId == null) {
      setTemplateRows([])
      setActivePlacement('')
      return
    }
    let cancelled = false
    setTemplatesLoading(true)
    fetch(`/api/printful/products/${encodeURIComponent(pid)}/templates?variant_id=${printfulVariantId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('templates'))))
      .then((body: { placements?: PlacementTemplateRow[] }) => {
        if (!cancelled) setTemplateRows(body.placements ?? [])
      })
      .catch(() => { if (!cancelled) setTemplateRows([]) })
      .finally(() => { if (!cancelled) setTemplatesLoading(false) })
    return () => { cancelled = true }
  }, [localDraft?.base_model_id, printfulVariantId])

  // Auto-save design_state 2s after the user stops making changes
  useEffect(() => {
    if (!draftId) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveState('saving')
      void updateDesignDraft(draftId, { design_state: designDataRef.current })
        .then((ok) => {
          setAutoSaveState(ok ? 'saved' : 'idle')
          if (ok) setTimeout(() => setAutoSaveState('idle'), 2000)
        })
        .catch(() => setAutoSaveState('idle'))
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [draftId, designData])

  const handlePrintfulVariantChange = useCallback(
    async (nextId: number) => {
      setPrintfulVariantId(nextId)
      const nextState: Record<string, unknown> = {
        ...designDataRef.current,
        printful_variant_id: nextId,
      }
      setDesignData(nextState)
      if (draftId) {
        await updateDesignDraft(draftId, { design_state: nextState })
        setLocalDraft((prev) => (prev ? { ...prev, design_state: nextState } : null))
      }
    },
    [draftId]
  )

  const handlePlacementsStateChange = useCallback(
    (
      nextOrUpdater:
        | PrintfulPlacementsState
        | ((prev: PrintfulPlacementsState) => PrintfulPlacementsState)
    ) => {
      setDesignData((prev) => {
        const full = { ...(typeof prev === 'object' && prev !== null ? prev : {}) }
        const currentPlacements = parsePrintfulPlacements(full)
        const nextPlacements =
          typeof nextOrUpdater === 'function'
            ? nextOrUpdater(currentPlacements)
            : nextOrUpdater
        return mergePrintfulPlacementsIntoDesignState(full, nextPlacements)
      })
    },
    []
  )

  const handleSavePlacementLayout = useCallback(async () => {
    if (!draftId) return
    setPlacementSaveLoading(true)
    try {
      const state = designDataRef.current
      const ok = await updateDesignDraft(draftId, { design_state: state })
      if (ok) {
        setLocalDraft((prev) => (prev ? { ...prev, design_state: state } : null))
      }
    } finally {
      setPlacementSaveLoading(false)
    }
  }, [draftId])

  const handleRefreshPrintfulPreview = useCallback(async () => {
    if (!draftId) return
    setPrintfulPreviewLoading(true)
    setMockupCatalogOnly(false)
    try {
      await updateDesignDraft(draftId, { design_state: designDataRef.current })
      setLocalDraft((prev) =>
        prev ? { ...prev, design_state: designDataRef.current } : null
      )
      const res = await fetch(`/api/design-drafts/${draftId}/preview-mockups`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        placements?: PlacementTab[]
        mockup_generation_unavailable?: boolean
        mockup_error?: string
        error?: string
      }
      if (!res.ok) {
        console.warn('[preview-mockups]', body.error ?? res.status)
        setPlacementMockups([])
        setMockupCatalogOnly(true)
        return
      }
      if (body.mockup_error) {
        console.error('[preview-mockups] Printful task error:', body.mockup_error, body)
      }
      setMockupCatalogOnly(Boolean(body.mockup_generation_unavailable))
      setPlacementMockups(body.placements?.length ? body.placements : [])
      setHasGeneratedMockups(true)
    } finally {
      setPrintfulPreviewLoading(false)
    }
  }, [draftId])

  const handleAiPatternApplied = useCallback(
    async (storagePath: string) => {
      if (!draftId) return
      const ok = await updateDesignDraft(draftId, {
        pattern_image_url: storagePath,
        pattern_source_type: 'ai_generated',
      })
      if (ok) {
        setLocalDraft((prev) =>
          prev
            ? {
                ...prev,
                pattern_image_url: storagePath,
                pattern_source_type: 'ai_generated',
              }
            : null
        )
      } else {
        throw new Error('update failed')
      }
    },
    [draftId]
  )

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

  const handleCreateProductFromDraft = useCallback(async () => {
    if (!draftId) return
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
      const res = await fetch(`/api/design-drafts/${draftId}/create-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price: priceNum,
          categoryId: categoryId !== '' ? (categoryId as number) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.productId) {
        router.push('/profile')
      } else {
        setCreateError((data.error as string) || 'Failed to create product. Please try again.')
      }
    } catch {
      setCreateError('Something went wrong. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }, [draftId, name, price, categoryId, router])

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
      {isDraftEditor && (
        <div className="design-tool-step-bar">
          <a href="/design-tool" className="design-tool-back-link">← Change shoe</a>
          <div className="design-tool-steps" aria-label="Progress">
            <span className="design-tool-step design-tool-step--done">Model</span>
            <span className="design-tool-step-sep" aria-hidden="true">›</span>
            <span className="design-tool-step design-tool-step--active" aria-current="step">Design</span>
            <span className="design-tool-step-sep" aria-hidden="true">›</span>
            <span className="design-tool-step">Publish</span>
          </div>
          {autoSaveState !== 'idle' && (
            <span className="design-tool-autosave" aria-live="polite">
              {autoSaveState === 'saving' ? 'Saving…' : 'Saved ✓'}
            </span>
          )}
        </div>
      )}
      <div className="design-tool-layout">
        <section
          className={`design-tool-left ${mode === 'manual' ? 'design-tool-left--manual' : ''}`}
          id="design-tool-left-panel"
          aria-labelledby="design-tool-tabs"
          role="region"
        >
          <ModeTabs mode={mode} onModeChange={setMode} />
          <div className="design-tool-panel-content">
            {mode === 'ai' ? (
              <AIPromptPanel
                draftId={draftId}
                onPatternApplied={handleAiPatternApplied}
              />
            ) : (
              <ManualEditorPlaceholder />
            )}

            {isDraftEditor &&
              localDraft?.base_model_id &&
              typeof localDraft.base_model_id === 'string' &&
              printfulVariantId != null &&
              /* Only show placement controls after the user has added a pattern image */
              Boolean(
                (localDraft.pattern_image_url && String(localDraft.pattern_image_url).trim()) ||
                (typeof designData.imageUrl === 'string' && designData.imageUrl.trim())
              ) && (
                <PlacementEditorPanel
                  productId={localDraft.base_model_id.trim()}
                  variantId={printfulVariantId}
                  placementsState={parsePrintfulPlacements(designData)}
                  onPlacementsStateChange={handlePlacementsStateChange}
                  onSaveLayout={handleSavePlacementLayout}
                  onRefreshPrintfulPreview={handleRefreshPrintfulPreview}
                  hasPatternImage={Boolean(
                    localDraft.pattern_image_url && String(localDraft.pattern_image_url).trim()
                  )}
                  patternImageUrl={patternImageSignedUrl}
                  saveLoading={placementSaveLoading}
                  previewLoading={printfulPreviewLoading}
                  externalTemplateRows={templateRows}
                  externalTemplatesLoading={templatesLoading}
                  externalActivePlacement={activePlacement}
                  onExternalActivePlacementChange={setActivePlacement}
                  hideCanvas
                  hideActions
                />
              )}
          </div>
          <div className="design-tool-product-form">
            {isDraftEditor ? (
              <div className="design-tool-form-actions">
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-draft"
                  disabled={createLoading}
                  onClick={handleSaveDraft}
                >
                  {createLoading ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-publish"
                  onClick={() => setIsCreateDrawerOpen(true)}
                >
                  Create product
                </button>
              </div>
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
            placementMockups={placementMockups.length > 0 ? placementMockups : null}
            catalogFallbackUrl={catalogFallbackUrl || null}
            catalogOnlyReference={mockupCatalogOnly}
            selectedModelName={selectedModelName}
            mockupImagesLoading={mockupImagesLoading || printfulPreviewLoading}
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
            templateRows={templateRows}
            templatesLoading={templatesLoading}
            placementsState={parsePrintfulPlacements(designData)}
            activePlacement={activePlacement}
            onActivePlacementChange={setActivePlacement}
            onPlacementsStateChange={handlePlacementsStateChange}
            onSaveLayout={isDraftEditor ? handleSavePlacementLayout : undefined}
            onRefreshPrintfulPreview={isDraftEditor ? handleRefreshPrintfulPreview : undefined}
            saveLoading={placementSaveLoading}
            previewLoading={printfulPreviewLoading}
            hasPatternImage={Boolean(
              localDraft?.pattern_image_url && String(localDraft.pattern_image_url).trim()
            )}
            hasGeneratedMockups={hasGeneratedMockups}
          />
        </section>
      </div>

      {/* Create product slide-over drawer */}
      {isCreateDrawerOpen && isDraftEditor && (
        <>
          <div
            className="design-tool-drawer-backdrop"
            onClick={() => setIsCreateDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className="design-tool-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Create product"
          >
            <div className="design-tool-drawer-header">
              <h3 className="design-tool-drawer-title">Create product</h3>
              <button
                type="button"
                className="design-tool-drawer-close"
                onClick={() => setIsCreateDrawerOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="design-tool-drawer-body">
              <label htmlFor="dt-drawer-name" className="design-tool-label">
                Product name
              </label>
              <input
                id="dt-drawer-name"
                type="text"
                className="design-tool-input"
                placeholder="Product name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required
              />
              <label htmlFor="dt-drawer-price" className="design-tool-label">
                Price ($)
              </label>
              <input
                id="dt-drawer-price"
                type="number"
                min={0}
                step={0.01}
                className="design-tool-input"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-required
              />
              <label htmlFor="dt-drawer-category" className="design-tool-label">
                Category
              </label>
              <select
                id="dt-drawer-category"
                className="design-tool-select"
                value={categoryId === '' ? '' : String(categoryId)}
                onChange={(e) =>
                  setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                }
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
              <div className="design-tool-drawer-actions">
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-draft"
                  onClick={() => setIsCreateDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="design-tool-btn design-tool-btn-publish"
                  disabled={createLoading}
                  onClick={handleCreateProductFromDraft}
                >
                  {createLoading ? 'Creating…' : 'Create product'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
