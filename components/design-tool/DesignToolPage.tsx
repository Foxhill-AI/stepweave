'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ModeTabs, { type DesignToolMode } from './ModeTabs'
import AIPromptPanel from './AIPromptPanel'
import ManualEditorPlaceholder from './ManualEditorPlaceholder'
import PreviewWorkspace, { type PlacementTab } from './PreviewWorkspace'
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

  // Load product variants, resolve variant_id, generate Printful mockups per placement (same variant).
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
    setMockupImagesLoading(true)
    setPlacementMockups([])

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
          if (cancelled) return Promise.reject(new Error('cancel'))
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
            return Promise.reject(new Error('no variant'))
          }
          setPrintfulVariantId(vid)
          const vrow = variants.find((v) => v.id === vid)
          setCatalogFallbackUrl(
            ((vrow?.image || productBody.image) ?? '').trim()
          )

          return fetch(
            `/api/printful/products/${encodeURIComponent(pid)}/mockup-images?variant_id=${vid}`
          )
        }
      )
      .then((mockRes) => {
        if (cancelled) return
        if (!mockRes || !mockRes.ok) return Promise.reject(new Error('mockup'))
        return mockRes.json()
      })
      .then(
        (body: {
          placements?: PlacementTab[]
          mockup_generation_unavailable?: boolean
        }) => {
          if (cancelled || !body?.placements) return
          setMockupCatalogOnly(Boolean(body.mockup_generation_unavailable))
          setPlacementMockups(
            body.placements.length ? body.placements : []
          )
        }
      )
      .catch(() => {
        if (!cancelled) {
          setPlacementMockups([])
          setMockupCatalogOnly(false)
        }
      })
      .finally(() => {
        if (!cancelled) setMockupImagesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    localDraft?.base_model_id,
    localDraft?.structural_color,
    designData.printful_variant_id,
  ])

  const handlePrintfulVariantChange = useCallback(
    async (nextId: number) => {
      setPrintfulVariantId(nextId)
      const nextState = {
        ...(typeof designData === 'object' && designData !== null ? designData : {}),
        printful_variant_id: nextId,
      }
      setDesignData(nextState)
      if (draftId) {
        const merged = {
          ...((localDraft?.design_state &&
            typeof localDraft.design_state === 'object' &&
            localDraft.design_state) as Record<string, unknown>),
          printful_variant_id: nextId,
        }
        await updateDesignDraft(draftId, { design_state: merged })
        setLocalDraft((prev) => (prev ? { ...prev, design_state: merged } : null))
      }
    },
    [draftId, designData, localDraft?.design_state]
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
              <AIPromptPanel />
            ) : (
              <>
                {isDraftEditor && variantOptions.length > 0 && (
                  <div className="design-tool-variant-row">
                    <label htmlFor="design-tool-printful-variant" className="design-tool-label">
                      Shoe color &amp; size (Printful variant)
                    </label>
                    <select
                      id="design-tool-printful-variant"
                      className="design-tool-select"
                      value={printfulVariantId ?? ''}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        if (Number.isFinite(id)) void handlePrintfulVariantChange(id)
                      }}
                    >
                      {variantOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <p className="design-tool-variant-hint">
                      Mockups use this variant for all placements. Changing it reloads reference images.
                    </p>
                  </div>
                )}
                <ManualEditorPlaceholder />
              </>
            )}
          </div>
          <div className="design-tool-product-form">
            {isDraftEditor ? (
              <>
                <h3 className="design-tool-form-title">Save &amp; create product</h3>
                <label htmlFor="design-tool-draft-name" className="design-tool-label">
                  Product name
                </label>
                <input
                  id="design-tool-draft-name"
                  type="text"
                  className="design-tool-input"
                  placeholder="Product name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-required
                />
                <label htmlFor="design-tool-draft-price" className="design-tool-label">
                  Price ($)
                </label>
                <input
                  id="design-tool-draft-price"
                  type="number"
                  min={0}
                  step={0.01}
                  className="design-tool-input"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  aria-required
                />
                <label htmlFor="design-tool-draft-category" className="design-tool-label">
                  Category
                </label>
                <select
                  id="design-tool-draft-category"
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
                    onClick={handleSaveDraft}
                  >
                    {createLoading ? 'Saving…' : 'Save as Draft'}
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
            placementMockups={placementMockups.length > 0 ? placementMockups : null}
            catalogFallbackUrl={catalogFallbackUrl || null}
            catalogOnlyReference={mockupCatalogOnly}
            selectedModelName={selectedModelName}
            mockupImagesLoading={mockupImagesLoading}
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
