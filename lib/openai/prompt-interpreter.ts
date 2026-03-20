import OpenAI from 'openai'

export type InterpretedPrompt = {
  prompt_for_image_model: string
  negative_prompt: string
  style_summary: string
}

const SYSTEM = `You are a prompt engineer for generating flat product pattern / graphic design images suitable for print-on-demand (e.g. shoe panels, fabric, simple logos, repeating patterns).

Return ONLY a JSON object with exactly these string keys:
- "prompt_for_image_model": a single detailed English prompt for an image model (describe subject, colors, composition, style). Keep it suitable for commercial POD — no hateful, sexual, or violent content.
- "negative_prompt": things to avoid (e.g. blurry, watermark, text unless requested, distorted).
- "style_summary": one short line summarizing the look.

Do not include markdown, code fences, or extra keys.`

/**
 * Expands the user's short idea into structured prompts for Fal / SDXL.
 */
export async function interpretDesignPrompt(
  userPrompt: string
): Promise<InterpretedPrompt> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini'
  const openai = new OpenAI({ apiKey })

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `User request:\n${userPrompt.trim()}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 800,
  })

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) {
    throw new Error('Empty interpreter response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error('Interpreter returned invalid JSON')
  }

  const o = parsed as Record<string, unknown>
  const prompt_for_image_model = String(o.prompt_for_image_model ?? '').trim()
  const negative_prompt = String(o.negative_prompt ?? '').trim()
  const style_summary = String(o.style_summary ?? '').trim()

  if (!prompt_for_image_model) {
    throw new Error('Interpreter missing prompt_for_image_model')
  }

  return {
    prompt_for_image_model,
    negative_prompt,
    style_summary,
  }
}
