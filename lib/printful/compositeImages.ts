import sharp from 'sharp'
import { compactToPrintfulPosition } from '@/lib/designDraftState'

export type CompositeLayerInput = {
  signedUrl: string
  s: number
  dx: number
  dy: number
}

/**
 * Downloads all layer images and composites them onto a transparent canvas
 * of the given printfile dimensions. Returns a PNG Buffer.
 *
 * Layers are composited in array order (first = bottom, last = top).
 */
export async function compositeLayersToBuffer(
  areaWidth: number,
  areaHeight: number,
  layers: CompositeLayerInput[]
): Promise<Buffer> {
  if (layers.length === 0) throw new Error('No layers to composite')

  // Fetch all images in parallel
  const fetched = await Promise.all(
    layers.map(async (layer) => {
      const res = await fetch(layer.signedUrl)
      if (!res.ok) throw new Error(`Failed to fetch layer image: ${res.status}`)
      const buf = await res.arrayBuffer()
      return { buffer: Buffer.from(buf), layer }
    })
  )

  // Resize each image to its target dimensions and compute integer position
  const compositeInputs = await Promise.all(
    fetched.map(async ({ buffer, layer }) => {
      const pos = compactToPrintfulPosition(areaWidth, areaHeight, layer)
      const resized = await sharp(buffer)
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
  const result = await sharp({
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

  return result
}
