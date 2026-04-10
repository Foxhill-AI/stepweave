import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import {
  clampTextAnchorInPrintfile,
  getImageLayerDimensions,
  isImageLayer,
  isTextLayer,
  type PlacementLayer,
} from '@/lib/designDraftState'
import {
  getServerCanvasFontFamilyName,
  getServerCanvasFontKind,
} from '@/lib/fonts'

/**
 * Resolve the fonts directory. Primary: process.cwd()/lib/printful/fonts
 * (works when Next.js outputFileTracingIncludes copies the TTFs correctly).
 * Fallback: path relative to __dirname — useful if the route is compiled inside
 * .next/server/... and the fonts end up alongside.
 */
function resolveFontsDir(): string {
  const cwdPath = path.join(process.cwd(), 'lib', 'printful', 'fonts')
  if (fs.existsSync(path.join(cwdPath, 'NotoSans-Regular.ttf'))) return cwdPath
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'lib', 'printful', 'fonts')
    if (fs.existsSync(path.join(candidate, 'NotoSans-Regular.ttf'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return cwdPath
}

let canvasFontsRegistered = false
function ensureCanvasFontsRegistered(): void {
  if (canvasFontsRegistered) return
  const fontsDir = resolveFontsDir()
  console.info('[compositeImages] registering fonts from', fontsDir)
  const entries: Array<[string, 'sans' | 'serif' | 'mono']> = [
    ['NotoSans-Regular.ttf', 'sans'],
    ['NotoSerif-Regular.ttf', 'serif'],
    ['NotoSansMono-Regular.ttf', 'mono'],
  ]
  for (const [file, kind] of entries) {
    const fullPath = path.join(fontsDir, file)
    if (!fs.existsSync(fullPath)) {
      console.error(
        '[compositeImages] MISSING font file — tofu likely:',
        fullPath,
        '| cwd:',
        process.cwd(),
        '| __dirname:',
        __dirname
      )
      continue
    }
    const familyName = getServerCanvasFontFamilyName(kind)
    const result = GlobalFonts.registerFromPath(fullPath, familyName)
    if (result == null) {
      console.error(
        '[compositeImages] registerFromPath returned null for',
        file,
        '— @napi-rs/canvas may have loaded wrong platform binary'
      )
    } else {
      console.info('[compositeImages] registered', file, 'as', familyName)
    }
  }
  canvasFontsRegistered = true
}

export type CompositeLayerInput = {
  kind: 'image'
  signedUrl: string
  width: number
  height: number
  dx: number
  dy: number
  rotation: number
}

export type CompositeTextInput = {
  kind: 'text'
  text: string
  fontFamily: string
  fontSize: number
  color: string
  dx: number
  dy: number
  rotation: number
}

export type CompositeInput = CompositeLayerInput | CompositeTextInput

/**
 * Build composite inputs from design_state layers. All image layers are drawn first (bottom),
 * then all text layers (top). This avoids mockups missing text when array order is [text, image] —
 * the in-editor canvas can show the selected layer on top regardless of array order.
 */
export function placementLayersToCompositeInputs(
  layers: PlacementLayer[],
  signedByPath: Map<string, string>,
  areaWidth: number,
  areaHeight: number
): CompositeInput[] {
  const inputs: CompositeInput[] = []
  for (const l of layers) {
    if (!isImageLayer(l)) continue
    const url = signedByPath.get(l.path)
    if (url) {
      const { w, h } = getImageLayerDimensions(l, areaWidth, areaHeight)
      inputs.push({
        kind: 'image',
        signedUrl: url,
        width: w,
        height: h,
        dx: l.dx,
        dy: l.dy,
        rotation: l.rotation ?? 0,
      })
    }
  }
  for (const l of layers) {
    if (!isTextLayer(l)) continue
    inputs.push({
      kind: 'text',
      text: l.text,
      fontFamily: l.fontFamily,
      fontSize: l.fontSize,
      color: l.color,
      dx: l.dx,
      dy: l.dy,
      rotation: l.rotation ?? 0,
    })
  }
  return inputs
}

async function renderImageLayerToFullCanvas(
  areaWidth: number,
  areaHeight: number,
  input: CompositeLayerInput
): Promise<Buffer> {
  ensureCanvasFontsRegistered()
  const cw = Math.max(1, Math.round(areaWidth))
  const ch = Math.max(1, Math.round(areaHeight))
  const canvas = createCanvas(cw, ch)
  const ctx = canvas.getContext('2d')

  const res = await fetch(input.signedUrl)
  if (!res.ok) throw new Error(`Failed to fetch layer image: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const img = await loadImage(buf)

  const w = Math.max(1, Math.round(input.width))
  const h = Math.max(1, Math.round(input.height))
  const rad = (input.rotation * Math.PI) / 180
  ctx.save()
  ctx.translate(cw / 2 + input.dx, ch / 2 + input.dy)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()

  return canvas.toBuffer('image/png')
}

/**
 * Renders a text layer as a full printfile-sized PNG (transparent) using @napi-rs/canvas + Noto.
 */
function renderTextToBuffer(areaWidth: number, areaHeight: number, input: CompositeTextInput): Buffer {
  ensureCanvasFontsRegistered()
  const w = Math.max(1, Math.round(areaWidth))
  const h = Math.max(1, Math.round(areaHeight))
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const kind = getServerCanvasFontKind(input.fontFamily)
  const family = getServerCanvasFontFamilyName(kind)
  const size = Math.max(1, Math.round(input.fontSize))
  let x = w / 2 + input.dx
  let y = h / 2 + input.dy
  const clamped = clampTextAnchorInPrintfile(w, h, x, y, size)
  if (clamped.x !== x || clamped.y !== y) {
    console.warn('[compositeImages] text anchor clamped to print area', {
      before: { x, y },
      after: clamped,
      printfile: { w, h },
    })
  }
  x = clamped.x
  y = clamped.y
  ctx.font = `${size}px ${family}`
  ctx.fillStyle = input.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const rot = (input.rotation * Math.PI) / 180
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillText(input.text, 0, 0)
  ctx.restore()
  return canvas.toBuffer('image/png')
}

/**
 * Downloads all image layers, renders all text layers, and composites everything
 * onto a transparent canvas of the given printfile dimensions. Returns a PNG Buffer.
 *
 * Layers are composited in array order (first = bottom, last = top).
 */
export async function compositeLayersToBuffer(
  areaWidth: number,
  areaHeight: number,
  layers: CompositeInput[]
): Promise<Buffer> {
  if (layers.length === 0) throw new Error('No layers to composite')

  const compositeInputs = await Promise.all(
    layers.map(async (layer) => {
      if (layer.kind === 'text') {
        return {
          input: renderTextToBuffer(areaWidth, areaHeight, layer),
          left: 0,
          top: 0,
        }
      }
      const png = await renderImageLayerToFullCanvas(areaWidth, areaHeight, layer)
      return {
        input: png,
        left: 0,
        top: 0,
      }
    })
  )

  return sharp({
    create: {
      width: areaWidth,
      height: areaHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer()
}
