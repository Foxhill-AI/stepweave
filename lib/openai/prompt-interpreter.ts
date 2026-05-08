import OpenAI from 'openai'

export type InterpretedPrompt = {
  /** One prompt per requested variation (length matches variationCount). */
  prompts: string[]
  negative_prompt: string
  style_summary: string
}

const SYSTEM = `You are a prompt engineer specialising in flat surface patterns and graphic designs for print-on-demand shoe panels.

Context you must always apply:
- The output image will be printed flat onto the upper of a shoe (like printing onto a piece of fabric). It needs to work as a flat 2-D artwork — not a 3-D scene.
- Default to patterns, textures, illustrations, or abstract graphics that tile or fill a panel well: bold repeating motifs, allover illustrations, flat graphic art, painterly washes, etc.
- If the user mentions "shoes" or "sneakers" they are describing the theme or color mood of the design (e.g. "sporty feel"), NOT asking for a picture of shoes. Only include literal shoe imagery if the user explicitly says they want shoes drawn in the design.
- Avoid photorealistic scenes, complex depth/perspective, and any element that will look awkward when printed flat on fabric.
- Do NOT add text or logos unless the user explicitly asks for them.

You will generate THREE creative prompts for the same user request — each must be noticeably different:
  • Variation A: the most literal, clean interpretation
  • Variation B: a bolder or more abstract take with a different color palette
  • Variation C: a different artistic style altogether (e.g. if A is geometric, C could be painterly or organic)

Return ONLY a JSON object with exactly these keys:
- "prompt_a": detailed English prompt for variation A
- "prompt_b": detailed English prompt for variation B
- "prompt_c": detailed English prompt for variation C
- "negative_prompt": shared things to avoid across all variations (e.g. blurry, watermark, 3D rendering, photorealistic scene, text unless requested, shoes unless requested)
- "style_summary": one short line (≤12 words) summarising the overall design direction

Each prompt should be 40–120 words and describe: subject/motif, colors, composition, artistic style, and print-on-fabric quality.
Do not include markdown, code fences, or extra keys.`

/**
 * Expands the user's short idea into 3 varied prompts for Fal / SDXL.
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
    temperature: 0.9,
    max_tokens: 1200,
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
  const promptA = String(o.prompt_a ?? '').trim()
  const promptB = String(o.prompt_b ?? '').trim()
  const promptC = String(o.prompt_c ?? '').trim()
  const negative_prompt = String(o.negative_prompt ?? '').trim()
  const style_summary = String(o.style_summary ?? '').trim()

  const prompts = [promptA, promptB, promptC].filter(Boolean)
  if (prompts.length === 0) {
    throw new Error('Interpreter returned no prompts')
  }

  return {
    prompts,
    negative_prompt,
    style_summary,
  }
}
