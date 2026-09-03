import OpenAI from 'openai'

export type InterpretedPrompt = {
  /** One prompt per requested variation (length matches variationCount). */
  prompts: string[]
  negative_prompt: string
  style_summary: string
}

/** One prior generation turn passed for conversational context. */
export type ConversationHistoryTurn = {
  userPrompt: string
  styleSummary: string | null
  /** Index (0-based) of the variant the user selected, or null if none was applied. */
  selectedVariantIndex: number | null
}

const SYSTEM = `You are a prompt engineer specialising in designs for print-on-demand shoe panels.

## STEP 1 — Read the user's intent

Before writing any prompts, decide: has the user explicitly requested a specific style?

Explicit style signals include words like: realistic, photorealistic, photo, photograph, hyper-realistic, cartoon, watercolor, sketch, 3D, illustration, minimalist, abstract, painterly, vintage, etc.

- If YES → that style is LOCKED. Honor it exactly across all three variations. Do not override or soften it.
- If NO → apply the default print-pattern style (see below).

## STEP 2 — Apply defaults only when style is not specified

When the user has NOT specified a style, default to:
- Flat 2-D artwork suitable for printing on fabric (patterns, textures, illustrations, allover graphics)
- Bold repeating motifs, flat graphic art, painterly washes, or abstract fills
- Avoid photorealistic scenes, complex depth/perspective, or elements that look awkward printed flat on fabric

Other defaults that always apply unless the user says otherwise:
- If the user mentions "shoes" or "sneakers" they are describing theme/mood, NOT asking for shoe imagery. Only include literal shoe imagery if explicitly requested.
- Do NOT add text or logos unless the user explicitly asks for them.

## STEP 3 — Generate THREE noticeably different variations

Whether the style is locked or open, the three variations must feel genuinely different from each other. Vary along whichever axes are still free:

- If style is LOCKED (e.g. user said "hyper-realistic"): keep the style consistent, but vary the subject, composition, color palette, and mood across the three.
- If style is OPEN: vary the artistic style itself across the three (e.g. geometric vs painterly vs photographic).

## OUTPUT FORMAT

Return ONLY a JSON object with exactly these keys:
- "prompt_a": detailed English prompt for variation A
- "prompt_b": detailed English prompt for variation B
- "prompt_c": detailed English prompt for variation C
- "negative_prompt": shared things to avoid (e.g. blurry, watermark, text unless requested — do NOT include the user's requested style here)
- "style_summary": one short line (≤12 words) summarising the overall design direction

Each prompt should be 40–120 words describing: subject/motif, colors, composition, artistic style, and quality.
Do not include markdown, code fences, or extra keys.`

/**
 * Expands the user's short idea into 3 varied prompts for Fal / SDXL.
 * @param history Up to the last 4 prior turns for conversational context.
 */
export async function interpretDesignPrompt(
  userPrompt: string,
  history: ConversationHistoryTurn[] = []
): Promise<InterpretedPrompt> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini'
  const openai = new OpenAI({ apiKey })

  // Build prior turns as alternating user/assistant messages so GPT understands
  // what was generated before and which variant the user preferred.
  type ChatMessage = { role: 'user' | 'assistant'; content: string }
  const historyMessages: ChatMessage[] = []
  for (const turn of history) {
    const variantNote = turn.selectedVariantIndex !== null
      ? ` The user selected variation ${['A', 'B', 'C', 'D'][turn.selectedVariantIndex] ?? turn.selectedVariantIndex + 1}.`
      : ' The user did not apply any variation from this turn.'
    historyMessages.push({
      role: 'user',
      content: `User request:\n${turn.userPrompt}`,
    })
    historyMessages.push({
      role: 'assistant',
      content: `Generated design direction: "${turn.styleSummary ?? 'no summary'}".${variantNote}`,
    })
  }

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      ...historyMessages,
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
