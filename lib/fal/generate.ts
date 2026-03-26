import { fal } from '@fal-ai/client'

function configureFal() {
  const key =
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim() ||
    process.env.FAL_AI_API_KEY?.trim()
  if (!key) {
    throw new Error('FAL_KEY (or FAL_API_KEY) is not set')
  }
  fal.config({ credentials: key })
}

export type GeneratedImageRef = {
  imageUrl: string
  index: number
  nsfw: boolean
  seed: number
}

function extractImages(data: unknown): GeneratedImageRef[] {
  const d = data as { images?: Array<{ url: string }>; has_nsfw_concepts?: boolean[]; seed?: number }
  if (!d.images?.length) throw new Error('Fal returned no images')
  return d.images.map((img, index) => ({
    imageUrl: img.url,
    index,
    nsfw: Boolean(d.has_nsfw_concepts?.[index]),
    seed: typeof d.seed === 'number' ? d.seed : 0,
  }))
}

/**
 * Text-to-image via fal-ai/fast-sdxl (server-only).
 */
export async function generateTextToImageBatch(params: {
  prompt: string
  negativePrompt?: string
  count: number
}): Promise<GeneratedImageRef[]> {
  configureFal()
  const count = Math.min(Math.max(Math.floor(params.count), 1), 4)
  const result = await fal.subscribe('fal-ai/fast-sdxl', {
    input: {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt ?? '',
      num_images: count,
      image_size: 'square_hd',
      num_inference_steps: 25,
      guidance_scale: 7.5,
      enable_safety_checker: true,
      format: 'png',
    },
    logs: false,
  })
  return extractImages(result.data)
}

/**
 * Image-to-image via fal-ai/fast-sdxl/image-to-image (server-only).
 * @param imageUrl Publicly accessible URL of the reference image.
 * @param strength 0–1: how much to deviate from the reference (0.75 = balanced).
 */
export async function generateImageToImageBatch(params: {
  imageUrl: string
  prompt: string
  negativePrompt?: string
  strength?: number
  count: number
}): Promise<GeneratedImageRef[]> {
  configureFal()
  const count = Math.min(Math.max(Math.floor(params.count), 1), 4)
  const result = await fal.subscribe('fal-ai/fast-sdxl/image-to-image', {
    input: {
      prompt: params.prompt,
      image_url: params.imageUrl,
      strength: params.strength ?? 0.75,
      negative_prompt: params.negativePrompt ?? '',
      num_images: count,
      image_size: 'square_hd',
      num_inference_steps: 25,
      guidance_scale: 7.5,
      enable_safety_checker: true,
      format: 'png',
    },
    logs: false,
  })
  return extractImages(result.data)
}
