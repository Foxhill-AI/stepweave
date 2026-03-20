import type { FileEntry, PrintfulPrintfilesResult } from '@/lib/printful/mockupTask'
import {
  compactToPrintfulPosition,
  type PrintfulPlacementsState,
} from '@/lib/designDraftState'

export function resolvePlacementKeys(
  printfilesResult: PrintfulPrintfilesResult,
  variantId: number
): { placementKeys: string[]; variantMapping: { placements: Record<string, number> } | null } {
  const availablePlacements = printfilesResult.available_placements ?? {}
  const variantMapping = (printfilesResult.variant_printfiles ?? []).find(
    (vp) => vp.variant_id === variantId
  )
  if (!variantMapping?.placements || Object.keys(variantMapping.placements).length === 0) {
    return { placementKeys: [], variantMapping: null }
  }
  const placementKeys = Object.keys(variantMapping.placements).filter(
    (p) => p in availablePlacements
  )
  return { placementKeys, variantMapping }
}

export function buildPrintfileById(printfilesResult: PrintfulPrintfilesResult) {
  const printfileById = new Map<number, { width: number; height: number }>()
  for (const pf of printfilesResult.printfiles ?? []) {
    if (typeof pf.printfile_id === 'number' && pf.width && pf.height) {
      printfileById.set(pf.printfile_id, { width: pf.width, height: pf.height })
    }
  }
  return printfileById
}

/**
 * Build Mockup Generator `files` array: same image URL on every placement, positions from
 * printfile dimensions merged with optional compact transforms from design_state.
 */
export function buildMockupFileEntries(params: {
  placementKeys: string[]
  variantMapping: { placements: Record<string, number> }
  printfileById: Map<number, { width: number; height: number }>
  imageUrl: string
  placementTransforms: PrintfulPlacementsState
}): FileEntry[] {
  const { placementKeys, variantMapping, printfileById, imageUrl, placementTransforms } =
    params

  return placementKeys.map((placement) => {
    const printfileId = variantMapping.placements[placement]
    const pf = printfileById.get(printfileId)
    const areaWidth = pf?.width ?? 1800
    const areaHeight = pf?.height ?? 1800
    const t = placementTransforms[placement] ?? { s: 1, dx: 0, dy: 0 }
    const position = compactToPrintfulPosition(areaWidth, areaHeight, t)
    return {
      placement,
      image_url: imageUrl,
      position,
    }
  })
}
