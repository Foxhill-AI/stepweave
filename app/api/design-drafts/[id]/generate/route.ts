import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { moderateText, moderateImageUrl } from '@/lib/openai/moderation'
import { interpretDesignPrompt } from '@/lib/openai/prompt-interpreter'
import { generateTextToImageBatch, generateImageToImageBatch } from '@/lib/fal/generate'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600
const MAX_PROMPT_LENGTH = 4000

const CREDIT_LIMITS: Record<string, number> = {
  free: 20,
  starter: 50,
  pro: 300,
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

type GenerateBody = {
  mode?: 'text-to-image' | 'image-to-image'
  prompt?: string
  variationCount?: number
  /** Storage path of the reference image (required for image-to-image). */
  referenceImagePath?: string
}

/**
 * POST /api/design-drafts/[id]/generate
 * Path A (text-to-image): prompt → moderation → GPT interpreter → Fal fast-sdxl
 * Path B (image-to-image): referenceImagePath + prompt → moderation → GPT interpreter → Fal fast-sdxl/image-to-image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const draftId = Number(id)
  if (Number.isNaN(draftId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  let body: GenerateBody
  try {
    body = (await request.json()) as GenerateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const isImageToImage = body.mode === 'image-to-image'

  if (body.mode && body.mode !== 'text-to-image' && body.mode !== 'image-to-image') {
    return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 })
  }

  if (isImageToImage && !body.referenceImagePath) {
    return NextResponse.json({ error: 'referenceImagePath is required for image-to-image' }, { status: 400 })
  }

  const promptRaw = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!promptRaw) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  const prompt = promptRaw.slice(0, MAX_PROMPT_LENGTH)

  const variationCount = Math.min(
    Math.max(Number(body.variationCount) || 3, 1),
    4
  )

  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const { data: draft, error: draftError } = await supabase
    .from('design_draft')
    .select('id, user_account_id')
    .eq('id', draftId)
    .maybeSingle()

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const { data: userAccount } = await supabase
    .from('user_account')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (!userAccount || (draft.user_account_id as number) !== userAccount.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[generate] Missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // ── Credit check ─────────────────────────────────────────────────────────
  const { data: accountRow } = await admin
    .from('user_account')
    .select('subscription_tier')
    .eq('id', userAccount.id)
    .maybeSingle()
  const tier = (accountRow?.subscription_tier as string | null) ?? 'free'
  const creditLimit = CREDIT_LIMITS[tier] ?? CREDIT_LIMITS.free
  const month = currentMonth()

  const { data: usageRow } = await admin
    .from('user_credit_usage')
    .select('credits_used')
    .eq('user_account_id', userAccount.id)
    .eq('month', month)
    .maybeSingle()
  const creditsUsed = (usageRow?.credits_used as number | null) ?? 0

  if (creditsUsed >= creditLimit) {
    return NextResponse.json(
      {
        error: 'You have used all your design credits for this month. Upload your own photo to keep designing, or upgrade your plan for more credits.',
        creditsRemaining: 0,
        creditLimit,
      },
      { status: 402 }
    )
  }
  // ── End credit check ─────────────────────────────────────────────────────

  const textMod = await moderateText(prompt)
  if (!textMod.allowed) {
    return NextResponse.json({ error: textMod.message }, { status: 400 })
  }

  // For image-to-image: get a signed URL for the reference image and moderate it
  let referenceSignedUrl: string | null = null
  if (isImageToImage && body.referenceImagePath) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrls([body.referenceImagePath], SIGNED_URL_EXPIRES_IN)

    if (signErr || !signed?.[0]?.signedUrl) {
      console.error('[generate] reference signed URL', signErr?.message)
      return NextResponse.json({ error: 'Could not load reference image.' }, { status: 500 })
    }
    referenceSignedUrl = signed[0].signedUrl

    const imgMod = await moderateImageUrl(referenceSignedUrl)
    if (!imgMod.allowed) {
      return NextResponse.json({ error: imgMod.message }, { status: 400 })
    }
  }

  let interpreted: Awaited<ReturnType<typeof interpretDesignPrompt>>
  try {
    interpreted = await interpretDesignPrompt(prompt)
  } catch (e) {
    console.error('[generate] interpretDesignPrompt', e)
    interpreted = {
      prompts: [prompt.slice(0, 2000)],
      negative_prompt: 'blurry, low quality, watermark, distorted, ugly, shoes, sneakers, 3D render, photorealistic scene',
      style_summary: 'User-defined design',
    }
  }

  // Use up to variationCount prompts (interpreter always returns 3; user may request fewer)
  const promptsToUse = interpreted.prompts.slice(0, variationCount)

  let batch: Awaited<ReturnType<typeof generateTextToImageBatch>>
  try {
    if (isImageToImage && referenceSignedUrl) {
      batch = await generateImageToImageBatch({
        imageUrl: referenceSignedUrl,
        prompts: promptsToUse,
        negativePrompt: interpreted.negative_prompt,
      })
    } else {
      batch = await generateTextToImageBatch({
        prompts: promptsToUse,
        negativePrompt: interpreted.negative_prompt,
      })
    }
  } catch (e) {
    console.error('[generate] Fal', e)
    return NextResponse.json(
      { error: 'Image generation failed. Please try again.' },
      { status: 502 }
    )
  }

  const safe = batch.filter((b) => !b.nsfw)
  if (safe.length === 0) {
    return NextResponse.json(
      {
        error:
          'Generated images were blocked by the safety checker. Try a different prompt.',
      },
      { status: 400 }
    )
  }

  const generationId = crypto.randomUUID()
  const variants: Array<{
    id: string
    storagePath: string
    previewUrl: string
    seed: number
  }> = []

  for (let i = 0; i < safe.length; i++) {
    const item = safe[i]
    let imageRes: Response
    try {
      imageRes = await fetch(item.imageUrl)
    } catch {
      console.error('[generate] fetch fal image', item.imageUrl)
      continue
    }
    if (!imageRes.ok) {
      console.error('[generate] fetch fal image status', imageRes.status)
      continue
    }

    const contentType = imageRes.headers.get('content-type') || 'image/png'
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'
    const buffer = Buffer.from(await imageRes.arrayBuffer())
    const storagePath = `${authUser.id}/${draftId}/ai-${Date.now()}-${i}.${ext}`

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png',
        upsert: false,
      })

    if (upErr) {
      console.error('[generate] storage upload', upErr.message)
      continue
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrls([storagePath], SIGNED_URL_EXPIRES_IN)

    if (signError || !signed?.length || !signed[0]?.signedUrl) {
      console.error('[generate] createSignedUrls', signError?.message)
      continue
    }

    variants.push({
      id: `${generationId}-${i}`,
      storagePath,
      previewUrl: signed[0].signedUrl,
      seed: item.seed,
    })
  }

  if (variants.length === 0) {
    return NextResponse.json(
      { error: 'Could not save generated images. Please try again.' },
      { status: 500 }
    )
  }

  // ── Increment credit usage (upsert: insert or increment) ─────────────────
  const newCreditsUsed = creditsUsed + 1
  await admin.from('user_credit_usage').upsert(
    { user_account_id: userAccount.id, month, credits_used: newCreditsUsed },
    { onConflict: 'user_account_id,month' }
  )
  const creditsRemaining = Math.max(0, creditLimit - newCreditsUsed)
  // ─────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    generationId,
    style_summary: interpreted.style_summary,
    variants,
    creditsRemaining,
    creditLimit,
    tier,
  })
}
