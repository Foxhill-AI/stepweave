import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import {
  clampTextAnchorInPrintfile,
  compactToPrintfulPosition,
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
  // __dirname in a compiled Next.js App Router handler is typically
  // .next/server/chunks/ or .next/server/app/api/.../  — walk up until found.
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'lib', 'printful', 'fonts')
    if (fs.existsSync(path.join(candidate, 'NotoSans-Regular.ttf'))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  // Last resort: return cwd path anyway (will log missing below)
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
      console.error('[compositeImages] MISSING font file — tofu likely:', fullPath,
        '| cwd:', process.cwd(), '| __dirname:', __dirname)
      continue
    }
    const familyName = getServerCanvasFontFamilyName(kind)
    const result = GlobalFonts.registerFromPath(fullPath, familyName)
    if (result == null) {
      console.error('[compositeImages] registerFromPath returned null for', file,
        '— @napi-rs/canvas may have loaded wrong platform binary')
    } else {
      console.info('[compositeImages] registered', file, 'as', familyName)
    }
  }
  canvasFontsRegistered = true
}

export type CompositeLayerInput = {
  kind: 'image'
  signedUrl: string
  s: number
  dx: number
  dy: number
}

export type CompositeTextInput = {
  kind: 'text'
  text: string
  fontFamily: string
  fontSize: number
  color: string
  dx: number
  dy: number
}

export type CompositeInput = CompositeLayerInput | CompositeTextInput

/**
 * Build composite inputs from design_state layers. All image layers are drawn first (bottom),
 * then all text layers (top). This avoids mockups missing text when array order is [text, image] —
 * the in-editor canvas can show the selected layer on top regardless of array order.
 */
export function placementLayersToCompositeInputs(
  layers: PlacementLayer[],
  signedByPath: Map<string, string>
): CompositeInput[] {
  const inputs: CompositeInput[] = []
  for (const l of layers) {
    if (!isImageLayer(l)) continue
    const url = signedByPath.get(l.path)
    if (url) {
      inputs.push({ kind: 'image', signedUrl: url, s: l.s, dx: l.dx, dy: l.dy })
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
    })
  }
  return inputs
}

/**
 * Keep text anchor inside the printfile canvas. The editor allows unbounded dx/dy for text,
 * but a fixed PNG cannot draw outside its bounds — large dy would clip the entire glyph (invisible).
 */
function clampTextAnchor(
  w: number,
  h: number,
  x: number,
  y: number,
  fontSize: number
): { x: number; y: number } {
  const rawPad = Math.max(4, Math.ceil(fontSize * 0.55))
  const pad = Math.min(rawPad, Math.max(0, Math.floor(w / 2) - 1), Math.max(0, Math.floor(h / 2) - 1))
  const px = pad > 0 ? Math.max(pad, Math.min(w - pad, x)) : w / 2
  const py = pad > 0 ? Math.max(pad, Math.min(h - pad, y)) : h / 2
  return { x: px, y: py }
}

/**
 * Renders a text layer as a PNG buffer using @napi-rs/canvas + bundled Noto TTFs
 * (reliable on Vercel/Linux; Sharp+SVG relied on missing system fonts → tofu rectangles).
 */
function renderTextToBuffer(
  areaWidth: number,
  areaHeight: number,
  input: CompositeTextInput
): Buffer {
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
  ctx.fillText(input.text, x, y)
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

  // Resolve each layer to a positioned { input, left, top } for sharp composite
  const compositeInputs = await Promise.all(
    layers.map(async (layer) => {
      if (layer.kind === 'text') {
        return {
          input: renderTextToBuffer(areaWidth, areaHeight, layer),
          left: 0,
          top: 0,
        }
      }

      // Image layer: fetch → resize → position
      const res = await fetch(layer.signedUrl)
      if (!res.ok) throw new Error(`Failed to fetch layer image: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const pos = compactToPrintfulPosition(areaWidth, areaHeight, layer)
      const resized = await sharp(buf)
        .resize(pos.width, pos.height, { fit: 'fill' })
        .toBuffer()
      return {
        input: resized,
        left: Math.max(0, pos.left),
        top: Math.max(0, pos.top),
      }
    })
  )

  // Composite all layers onto a transparent RGBA base
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
