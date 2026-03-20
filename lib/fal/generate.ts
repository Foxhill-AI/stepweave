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

/**
 * Text-to-image via fal-ai/fast-sdxl (server-only).
 * Uses enable_safety_checker (default true on Fal).
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

  const { images, has_nsfw_concepts, seed } = result.data
  if (!images?.length) {
    throw new Error('Fal returned no images')
  }

  return images.map((img, index) => ({
    imageUrl: img.url,
    index,
    nsfw: Boolean(has_nsfw_concepts?.[index]),
    seed: typeof seed === 'number' ? seed : 0,
  }))
}
