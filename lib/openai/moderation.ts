import OpenAI from 'openai'

export type ModerationResult = { allowed: true } | { allowed: false; message: string }

/**
 * Text moderation via OpenAI Moderations API (server-only).
 * Set OPENAI_MODERATION_MODEL if needed (default: text-moderation-latest).
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { allowed: false, message: 'Please enter a prompt.' }
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { allowed: false, message: 'OpenAI is not configured on the server.' }
  }

  const openai = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODERATION_MODEL?.trim() || 'omni-moderation-latest'

  try {
    const mod = await openai.moderations.create({
      model,
      input: trimmed,
    })
    const flagged = mod.results[0]?.flagged ?? false
    if (flagged) {
      return {
        allowed: false,
        message:
          'This prompt was flagged by our safety check. Please revise and try again.',
      }
    }
    return { allowed: true }
  } catch (e) {
    console.error('[moderation]', e)
    return {
      allowed: false,
      message: 'Could not verify prompt safety. Please try again later.',
    }
  }
}
