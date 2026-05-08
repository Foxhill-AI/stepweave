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
 * Each prompt in `prompts` is generated as a separate call so every image
 * gets its own random seed, producing genuinely distinct results.
 */
export async function generateTextToImageBatch(params: {
  prompts: string[]
  negativePrompt?: string
}): Promise<GeneratedImageRef[]> {
  configureFal()
  const results = await Promise.all(
    params.prompts.map(async (prompt, i) => {
      const result = await fal.subscribe('fal-ai/fast-sdxl', {
        input: {
          prompt,
          negative_prompt: params.negativePrompt ?? '',
          num_images: 1,
          image_size: 'square_hd',
          num_inference_steps: 28,
          guidance_scale: 7.5,
          enable_safety_checker: true,
          format: 'png',
        },
        logs: false,
      })
      return extractImages(result.data).map((img) => ({ ...img, index: i }))
    })
  )
  return results.flat()
}

/**
 * Image-to-image via fal-ai/fast-sdxl/image-to-image (server-only).
 * Each prompt gets its own call for maximum variation.
 */
export async function generateImageToImageBatch(params: {
  imageUrl: string
  prompts: string[]
  negativePrompt?: string
  strength?: number
}): Promise<GeneratedImageRef[]> {
  configureFal()
  const results = await Promise.all(
    params.prompts.map(async (prompt, i) => {
      const result = await fal.subscribe('fal-ai/fast-sdxl/image-to-image', {
        input: {
          prompt,
          image_url: params.imageUrl,
          strength: params.strength ?? 0.75,
          negative_prompt: params.negativePrompt ?? '',
          num_images: 1,
          image_size: 'square_hd',
          num_inference_steps: 28,
          guidance_scale: 7.5,
          enable_safety_checker: true,
          format: 'png',
        },
        logs: false,
      })
      return extractImages(result.data).map((img) => ({ ...img, index: i }))
    })
  )
  return results.flat()
}
