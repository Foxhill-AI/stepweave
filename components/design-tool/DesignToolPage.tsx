'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AIPromptPanel from './AIPromptPanel'
import PlacementEditorPanel from './PlacementEditorPanel'
import PreviewWorkspace, { type PlacementTab } from './PreviewWorkspace'
import {
  mergePrintfulPlacementsIntoDesignState,
  parsePrintfulPlacements,
  parsePlacementImages,
  mergePlacementImagesIntoDesignState,
  addPlacementImageLayer,
  addPlacementTextLayer,
  updatePlacementLayer,
  removePlacementImageLayer,
  reorderPlacementLayer,
  duplicatePlacementLayer,
  appendPlacementLayerClone,
  isImageLayer,
  type PrintfulPlacementsState,
  type PlacementImageLayer,
  type PlacementTextLayer,
  type ResolvedPlacementLayer,
  type PlacementLayer,
  type PlacementLayerReorderOp,
} from '@/lib/designDraftState'
import type { PlacementTemplateRow } from '@/lib/printful/placementTemplate'
import { useAuth } from '@/components/AuthProvider'
import {
  getCategories,
  updateDesignDraft,
} from '@/lib/supabaseClient'
import type { CategoryRow, DesignDraftRow } from '@/lib/supabaseClient'
import PublishFlowModal from './PublishFlowModal'
import { fetchPreviewMockupsWithRetry } from '@/lib/design-tool/previewMockupsFetch'
import '../../styles/DesignTool.css'

interface DesignToolPageProps {
  /** When set, we are editing this design draft (from /design-tool/[id]). */
  draftId?: number
  draft?: DesignDraftRow
}

/** Distinct Printful placement keys from loaded template rows (preserves order). */
function uniqueTemplatePlacements(rows: PlacementTemplateRow[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    const p = r.placement
    if (typeof p !== 'string' || !p.trim()) continue
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

export default function DesignToolPage({ draftId, draft }: DesignToolPageProps) {
  const router = useRouter()
  const { user, userAccount } = useAuth()
  const [designData, setDesignData] = useState<Record<string, unknown>>(
    draft?.design_state && typeof draft.design_state === 'object' ? (draft.design_state as Record<string, unknown>) : {}
  )
  const [categories, setCategories] = useState<CategoryRow[]>([])
  /** Local copy of draft so we can update pattern_image_url after upload without refetch. */
  const [localDraft, setLocalDraft] = useState<DesignDraftRow | null>(draft ?? null)
  /** Resolved signed URL for draft pattern image (when using Storage). */
  const [patternImageSignedUrl, setPatternImageSignedUrl] = useState<string | null>(null)
  /** Signed URLs per placement + layer: { [placement]: { [layerId]: signedUrl } } */
  const [placementLayerSignedUrls, setPlacementLayerSignedUrls] = useState<Record<string, Record<string, string>>>({})
  /** Which layer is selected per placement: { [placement]: layerId } */
  const [selectedLayerByPlacement, setSelectedLayerByPlacement] = useState<Record<string, string>>({})
  /** Mockup URL per Printful placement (same variant). */
  const [placementMockups, setPlacementMockups] = useState<PlacementTab[]>([])
  const [catalogFallbackUrl, setCatalogFallbackUrl] = useState<string>('')
  const [variantOptions, setVariantOptions] = useState<
    Array<{
      id: number
      name: string
      color: string
      size: string
      image: string
      catalogPrice?: string | null
    }>
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
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false)
  /** Temporary object URLs for layers uploaded in this session (before server signed URL arrives). */
  const [localLayerUrls, setLocalLayerUrls] = useState<Record<string, string>>({})
  /** Clipboard for Cmd/Ctrl+C / V in template canvas (layer payload without signed URLs). */
  const layerClipboardRef = useRef<PlacementLayer | null>(null)
  /** Current step within the editor: chat → customize */
  const [editorStep, setEditorStep] = useState<'design' | 'customize'>('design')
  /** Mobile-only: collapsible adjustment panel open */
  const [showMobileTools, setShowMobileTools] = useState(false)

  const isDraftEditor = Boolean(draftId)
  /** Draft is linked to an existing storefront product — publish flow updates that row instead of inserting. */
  const isEditingPublishedProduct = Boolean(localDraft?.final_product_id)

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

  // Fetch signed URLs for per-placement image layers stored in design_state.pattern_images.
  // Re-runs whenever pattern_images changes (JSON key for stable comparison).
  const placementImagesJson = JSON.stringify(parsePlacementImages(designData))
  useEffect(() => {
    const images = parsePlacementImages(designData)
    if (!draftId || Object.keys(images).length === 0) {
      setPlacementLayerSignedUrls({})
      return
    }
    // Build nested paths map: { placement: { layerId: storagePath } } — image layers only
    const paths: Record<string, Record<string, string>> = {}
    for (const [placement, layers] of Object.entries(images)) {
      paths[placement] = {}
      for (const layer of layers) {
        if (isImageLayer(layer)) paths[placement][layer.id] = layer.path
      }
    }
    // If no image layers at all, skip the fetch
    const hasImagePaths = Object.values(paths).some((p) => Object.keys(p).length > 0)
    if (!hasImagePaths) {
      setPlacementLayerSignedUrls({})
      return
    }
    let cancelled = false
    fetch(`/api/design-drafts/${draftId}/placement-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: { urls?: Record<string, Record<string, string>> }) => {
        if (!cancelled) setPlacementLayerSignedUrls(body.urls ?? {})
      })
      .catch(() => {
        if (!cancelled) setPlacementLayerSignedUrls({})
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, placementImagesJson])

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
          currency?: string
          variants?: Array<{
            id: number
            name: string
            color: string
            size: string
            image: string
            catalogPrice?: string | null
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
        if (!cancelled) {
          const rows = body.placements ?? []
          setTemplateRows(rows)
          // Auto-select first placement if none is active yet
          setActivePlacement((prev) => prev || rows[0]?.placement || '')
        }
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
      const { ok, status, body } = await fetchPreviewMockupsWithRetry(draftId)
      if (!ok) {
        console.warn('[preview-mockups]', body.error ?? status)
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
    async (storagePath: string, previewUrl?: string) => {
      if (!draftId) return

      // One image layer per Printful placement so template tabs + mockups all show the pattern.
      const placementsList = uniqueTemplatePlacements(templateRows)
      let nextDesignState = designDataRef.current
      if (placementsList.length > 0) {
        let current = parsePlacementImages(nextDesignState)
        const selectedPatch: Record<string, string> = {}
        const localPatch: Record<string, string> = {}

        for (const placement of placementsList) {
          const newLayer: PlacementImageLayer = {
            id: crypto.randomUUID(),
            path: storagePath,
            s: 1,
            dx: 0,
            dy: 0,
          }
          current = addPlacementImageLayer(current, placement, newLayer)
          selectedPatch[placement] = newLayer.id
          if (previewUrl) localPatch[newLayer.id] = previewUrl
        }

        nextDesignState = mergePlacementImagesIntoDesignState(nextDesignState, current)
        designDataRef.current = nextDesignState
        setDesignData(nextDesignState)
        setSelectedLayerByPlacement((prev) => ({ ...prev, ...selectedPatch }))
        if (!activePlacement) {
          setActivePlacement(placementsList[0])
        }
        if (Object.keys(localPatch).length > 0) {
          setLocalLayerUrls((prev) => ({ ...prev, ...localPatch }))
        }
      }

      const ok = await updateDesignDraft(draftId, {
        pattern_image_url: storagePath,
        pattern_source_type: 'ai_generated',
        ...(placementsList.length > 0 ? { design_state: nextDesignState } : {}),
      })
      if (ok) {
        setLocalDraft((prev) =>
          prev
            ? {
                ...prev,
                pattern_image_url: storagePath,
                pattern_source_type: 'ai_generated',
                ...(placementsList.length > 0 ? { design_state: nextDesignState } : {}),
              }
            : null
        )
        // Preview is generated on-demand in the customize step, not automatically here
      } else {
        throw new Error('update failed')
      }
    },
    [draftId, activePlacement, templateRows]
  )

  const handleUseDirectly = useCallback(
    async (storagePath: string) => {
      if (!draftId) return
      const placementsList = uniqueTemplatePlacements(templateRows)
      let nextDesignState = designDataRef.current
      if (placementsList.length > 0) {
        let current = parsePlacementImages(nextDesignState)
        const selectedPatch: Record<string, string> = {}
        for (const placement of placementsList) {
          const newLayer: PlacementImageLayer = { id: crypto.randomUUID(), path: storagePath, s: 1, dx: 0, dy: 0 }
          current = addPlacementImageLayer(current, placement, newLayer)
          selectedPatch[placement] = newLayer.id
        }
        nextDesignState = mergePlacementImagesIntoDesignState(nextDesignState, current)
        designDataRef.current = nextDesignState
        setDesignData(nextDesignState)
        setSelectedLayerByPlacement((prev) => ({ ...prev, ...selectedPatch }))
        if (!activePlacement) setActivePlacement(placementsList[0])
      }
      const ok = await updateDesignDraft(draftId, {
        pattern_image_url: storagePath,
        pattern_source_type: 'direct_upload',
        ...(placementsList.length > 0 ? { design_state: nextDesignState } : {}),
      })
      if (ok) {
        setLocalDraft((prev) =>
          prev
            ? { ...prev, pattern_image_url: storagePath, pattern_source_type: 'direct_upload',
                ...(placementsList.length > 0 ? { design_state: nextDesignState } : {}) }
            : null
        )
      } else {
        throw new Error('update failed')
      }
    },
    [draftId, activePlacement, templateRows]
  )

  const handlePatternUploaded = useCallback(
    (path: string, localUrl?: string) => {
      const placementsList = uniqueTemplatePlacements(templateRows)
      if (placementsList.length === 0) return

      let current = parsePlacementImages(designDataRef.current)
      const selectedPatch: Record<string, string> = {}
      const localPatch: Record<string, string> = {}

      for (const placement of placementsList) {
        const newLayer: PlacementImageLayer = {
          id: crypto.randomUUID(),
          path,
          s: 1,
          dx: 0,
          dy: 0,
        }
        current = addPlacementImageLayer(current, placement, newLayer)
        selectedPatch[placement] = newLayer.id
        if (localUrl) localPatch[newLayer.id] = localUrl
      }

      const next = mergePlacementImagesIntoDesignState(designDataRef.current, current)
      designDataRef.current = next
      setDesignData(next)
      if (Object.keys(localPatch).length > 0) {
        setLocalLayerUrls((prev) => ({ ...prev, ...localPatch }))
      }
      setSelectedLayerByPlacement((prev) => ({ ...prev, ...selectedPatch }))
      if (!activePlacement) {
        setActivePlacement(placementsList[0])
      }
    },
    [activePlacement, templateRows]
  )

  const handleLayerChange = useCallback(
    (layerId: string, patch: Parameters<typeof updatePlacementLayer>[3]) => {
      if (!activePlacement) return
      setDesignData((prev) => {
        const current = parsePlacementImages(prev)
        return mergePlacementImagesIntoDesignState(prev, updatePlacementLayer(current, activePlacement, layerId, patch))
      })
    },
    [activePlacement]
  )

  const handleAddTextLayer = useCallback(
    (layer: PlacementTextLayer) => {
      if (!activePlacement) return
      setDesignData((prev) => {
        const current = parsePlacementImages(prev)
        return mergePlacementImagesIntoDesignState(prev, addPlacementTextLayer(current, activePlacement, layer))
      })
      setSelectedLayerByPlacement((prev) => ({ ...prev, [activePlacement]: layer.id }))
    },
    [activePlacement]
  )

  const handleLayerRemove = useCallback(
    (placement: string, layerId: string) => {
      setDesignData((prev) => {
        const current = parsePlacementImages(prev)
        return mergePlacementImagesIntoDesignState(prev, removePlacementImageLayer(current, placement, layerId))
      })
      setSelectedLayerByPlacement((prev) => {
        if (prev[placement] === layerId) {
          const { [placement]: _, ...rest } = prev
          return rest
        }
        return prev
      })
    },
    []
  )

  const handleCanvasLayerDelete = useCallback(
    (layerId: string) => {
      if (!activePlacement) return
      handleLayerRemove(activePlacement, layerId)
    },
    [activePlacement, handleLayerRemove]
  )

  const handleLayerReorder = useCallback(
    (layerId: string, op: PlacementLayerReorderOp) => {
      if (!activePlacement) return
      setDesignData((prev) =>
        mergePlacementImagesIntoDesignState(
          prev,
          reorderPlacementLayer(parsePlacementImages(prev), activePlacement, layerId, op)
        )
      )
    },
    [activePlacement]
  )

  const handleLayerDuplicate = useCallback(
    (layerId: string) => {
      if (!activePlacement) return
      let newId: string | null = null
      setDesignData((prev) => {
        const cur = parsePlacementImages(prev)
        const r = duplicatePlacementLayer(cur, activePlacement, layerId)
        if (!r) return prev
        newId = r.newId
        return mergePlacementImagesIntoDesignState(prev, r.next)
      })
      if (newId) {
        const selectId = newId
        setSelectedLayerByPlacement((prev) => ({ ...prev, [activePlacement]: selectId }))
      }
    },
    [activePlacement]
  )

  const handlePasteLayer = useCallback(
    (layer: PlacementLayer) => {
      if (!activePlacement) return
      let newId: string | null = null
      setDesignData((prev) => {
        const cur = parsePlacementImages(prev)
        const r = appendPlacementLayerClone(cur, activePlacement, layer)
        newId = r.newId
        return mergePlacementImagesIntoDesignState(prev, r.next)
      })
      if (newId) {
        const selectId = newId
        setSelectedLayerByPlacement((prev) => ({ ...prev, [activePlacement]: selectId }))
      }
    },
    [activePlacement]
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


  // ── Shared derived values ────────────────────────────────────────────────
  const hasPatternImage = Boolean(
    (localDraft?.pattern_image_url && String(localDraft.pattern_image_url).trim()) ||
    Object.keys(parsePlacementImages(designData)).length > 0
  )

  const activeLayersResolved = (() => {
    const layers = parsePlacementImages(designData)[activePlacement] ?? []
    const urls = placementLayerSignedUrls[activePlacement] ?? {}
    return layers.map((l): ResolvedPlacementLayer =>
      isImageLayer(l) ? { ...l, signedUrl: urls[l.id] ?? localLayerUrls[l.id] ?? null } : l
    )
  })()

  // ── Step bar ─────────────────────────────────────────────────────────────
  const stepBar = isDraftEditor && (
    <div className="design-tool-step-bar">
      <a href="/design-tool" className="design-tool-back-link">← Change shoe</a>
      <div className="design-tool-steps" aria-label="Progress">
        <button
          type="button"
          className={`design-tool-step${editorStep === 'design' ? ' design-tool-step--active' : ' design-tool-step--btn'}`}
          aria-current={editorStep === 'design' ? 'step' : undefined}
          onClick={() => setEditorStep('design')}
        >
          Design
        </button>
        <span className="design-tool-step-sep" aria-hidden="true">›</span>
        <span
          className={`design-tool-step${editorStep === 'customize' ? ' design-tool-step--active' : ''}`}
          aria-current={editorStep === 'customize' ? 'step' : undefined}
        >
          Customize
        </span>
        <span className="design-tool-step-sep" aria-hidden="true">›</span>
        <span className="design-tool-step">
          {isEditingPublishedProduct ? 'Published' : 'Publish'}
        </span>
      </div>
      <div className="design-tool-step-bar-end">
        {editorStep === 'customize' && isDraftEditor && (
          <button
            type="button"
            className="design-tool-btn design-tool-btn-publish design-tool-step-bar-action"
            onClick={() => setIsFlowModalOpen(true)}
          >
            Finish →
          </button>
        )}
        {autoSaveState !== 'idle' && (
          <span className="design-tool-autosave" aria-live="polite">
            {autoSaveState === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
        )}
      </div>
    </div>
  )

  // ── DESIGN STEP: full-width chat ─────────────────────────────────────────
  if (editorStep === 'design') {
    return (
      <div className="design-tool-page">
        {stepBar}
        <div className="design-chat-layout">
          <div className="design-chat-panel">
            <AIPromptPanel
              draftId={draftId}
              onPatternApplied={handleAiPatternApplied}
              onUseDirectly={handleUseDirectly}
              onNext={isDraftEditor ? () => setEditorStep('customize') : undefined}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── CUSTOMIZE STEP: canvas + optional mobile sliders ─────────────────────
  const placementEditorNode = isDraftEditor &&
    localDraft?.base_model_id &&
    typeof localDraft.base_model_id === 'string' &&
    printfulVariantId != null ? (
    <PlacementEditorPanel
      productId={localDraft.base_model_id.trim()}
      variantId={printfulVariantId}
      placementsState={parsePrintfulPlacements(designData)}
      onPlacementsStateChange={handlePlacementsStateChange}
      onSaveLayout={handleSavePlacementLayout}
      onRefreshPrintfulPreview={handleRefreshPrintfulPreview}
      hasPatternImage={hasPatternImage}
      patternImageUrl={patternImageSignedUrl}
      saveLoading={placementSaveLoading}
      previewLoading={printfulPreviewLoading}
      externalTemplateRows={templateRows}
      externalTemplatesLoading={templatesLoading}
      externalActivePlacement={activePlacement}
      onExternalActivePlacementChange={setActivePlacement}
      hideCanvas
      hideActions
      activeLayers={activeLayersResolved}
      selectedLayerId={selectedLayerByPlacement[activePlacement] ?? null}
      onLayerSelect={(id) => setSelectedLayerByPlacement((prev) => ({ ...prev, [activePlacement]: id }))}
      onLayerChange={handleLayerChange}
      onLayerDelete={handleCanvasLayerDelete}
      onLayerReorder={handleLayerReorder}
      onLayerDuplicate={handleLayerDuplicate}
      onPasteLayer={handlePasteLayer}
      layerClipboardRef={layerClipboardRef}
    />
  ) : null

  return (
    <div className="design-tool-page">
      {stepBar}
      <div className="design-customize-layout">
        {/* Mobile: collapsible position slider panel */}
        {placementEditorNode && (
          <div className="design-customize-tools-mobile">
            <button
              type="button"
              className="design-customize-tools-toggle"
              onClick={() => setShowMobileTools((v) => !v)}
              aria-expanded={showMobileTools}
            >
              {showMobileTools ? '▲ Hide adjustments' : '▼ Adjust positions'}
            </button>
            {showMobileTools && (
              <div className="design-customize-tools-panel">{placementEditorNode}</div>
            )}
          </div>
        )}
        <div className="design-customize-canvas">
          <PreviewWorkspace
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
              const placementImages = parsePlacementImages(designData)
              const selectedId = selectedLayerByPlacement[activePlacement]
              const layers = placementImages[activePlacement] ?? []
              if (layers.length > 0) {
                const targetId = selectedId ?? layers[layers.length - 1].id
                handleLayerRemove(activePlacement, targetId)
              } else if (localDraft?.pattern_image_url) {
                handlePatternClear()
              } else {
                setDesignData((prev) => { const next = { ...prev }; delete next.imageUrl; return next })
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
            activePlacement={activePlacement}
            onActivePlacementChange={setActivePlacement}
            activeLayers={activeLayersResolved}
            selectedLayerId={selectedLayerByPlacement[activePlacement] ?? null}
            onLayerSelect={(id) => setSelectedLayerByPlacement((prev) => ({ ...prev, [activePlacement]: id }))}
            onLayerChange={handleLayerChange}
            onLayerDelete={handleCanvasLayerDelete}
            onLayerReorder={handleLayerReorder}
            onLayerDuplicate={handleLayerDuplicate}
            onPasteLayer={handlePasteLayer}
            layerClipboardRef={layerClipboardRef}
            onAddTextLayer={isDraftEditor ? handleAddTextLayer : undefined}
            onSaveLayout={isDraftEditor ? handleSavePlacementLayout : undefined}
            onRefreshPrintfulPreview={isDraftEditor ? handleRefreshPrintfulPreview : undefined}
            saveLoading={placementSaveLoading}
            previewLoading={printfulPreviewLoading}
            hasPatternImage={hasPatternImage}
            hasGeneratedMockups={hasGeneratedMockups}
          />
        </div>
      </div>
      <PublishFlowModal
        open={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        draftId={draftId ?? 0}
        localDraft={localDraft}
        printfulVariantId={printfulVariantId}
        categories={categories}
        isEditingPublishedProduct={isEditingPublishedProduct}
        designData={designData}
      />
    </div>
  )
}
