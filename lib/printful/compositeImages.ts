import sharp from 'sharp'
import { compactToPrintfulPosition } from '@/lib/designDraftState'
import { getServerFamily } from '@/lib/fonts'

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

/** Escape special XML characters for use inside SVG text content. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Renders a text layer as a PNG buffer using SVG + sharp.
 * The text is centered at (areaWidth/2 + dx, areaHeight/2 + dy).
 */
async function renderTextToBuffer(
  areaWidth: number,
  areaHeight: number,
  input: CompositeTextInput
): Promise<Buffer> {
  const x = Math.round(areaWidth / 2 + input.dx)
  const y = Math.round(areaHeight / 2 + input.dy)
  const serverFamily = getServerFamily(input.fontFamily)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${areaWidth}" height="${areaHeight}">
    <text
      x="${x}"
      y="${y}"
      font-family="${escapeXml(serverFamily)}"
      font-size="${input.fontSize}"
      fill="${escapeXml(input.color)}"
      text-anchor="middle"
      dominant-baseline="central"
    >${escapeXml(input.text)}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
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
        const buf = await renderTextToBuffer(areaWidth, areaHeight, layer)
        return { input: buf, left: 0, top: 0 }
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
