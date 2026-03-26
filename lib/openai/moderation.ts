import OpenAI from 'openai'

export type ModerationResult = { allowed: true } | { allowed: false; message: string }

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}

function getModel() {
  return process.env.OPENAI_MODERATION_MODEL?.trim() || 'omni-moderation-latest'
}

/**
 * Text moderation via OpenAI Moderations API (server-only).
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const trimmed = text.trim()
  if (!trimmed) return { allowed: false, message: 'Please enter a prompt.' }

  const openai = getOpenAI()
  if (!openai) return { allowed: false, message: 'OpenAI is not configured on the server.' }

  try {
    const mod = await openai.moderations.create({ model: getModel(), input: trimmed })
    if (mod.results[0]?.flagged) {
      return {
        allowed: false,
        message: 'This prompt was flagged by our safety check. Please revise and try again.',
      }
    }
    return { allowed: true }
  } catch (e) {
    console.error('[moderation:text]', e)
    return { allowed: false, message: 'Could not verify prompt safety. Please try again later.' }
  }
}

/**
 * Image moderation via OpenAI omni-moderation-latest (server-only).
 * @param imageUrl Publicly accessible URL (e.g. a Supabase signed URL).
 */
export async function moderateImageUrl(imageUrl: string): Promise<ModerationResult> {
  const openai = getOpenAI()
  if (!openai) return { allowed: false, message: 'OpenAI is not configured on the server.' }

  try {
    const mod = await openai.moderations.create({
      model: getModel(),
      input: [{ type: 'image_url' as const, image_url: { url: imageUrl } }],
    })
    if (mod.results[0]?.flagged) {
      return {
        allowed: false,
        message: 'The reference image was flagged by our safety check. Please use a different image.',
      }
    }
    return { allowed: true }
  } catch (e) {
    console.error('[moderation:image]', e)
    return { allowed: false, message: 'Could not verify image safety. Please try again later.' }
  }
}
