import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { moderateText, moderateImageUrl } from '@/lib/openai/moderation'
import { interpretDesignPrompt } from '@/lib/openai/prompt-interpreter'
import { generateTextToImageBatch, generateImageToImageBatch } from '@/lib/fal/generate'

const BUCKET = 'design-patterns'
const SIGNED_URL_EXPIRES_IN = 3600
const MAX_PROMPT_LENGTH = 4000

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

  const textMod = await moderateText(prompt)
  if (!textMod.allowed) {
    return NextResponse.json({ error: textMod.message }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[generate] Missing SUPABASE_SERVICE_ROLE_KEY or URL')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

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

  let interpreted: {
    prompt_for_image_model: string
    negative_prompt: string
    style_summary: string
  }
  try {
    interpreted = await interpretDesignPrompt(prompt)
  } catch (e) {
    console.error('[generate] interpretDesignPrompt', e)
    interpreted = {
      prompt_for_image_model: prompt.slice(0, 2000),
      negative_prompt: 'blurry, low quality, watermark, distorted, ugly',
      style_summary: 'User-defined design',
    }
  }

  let batch: Awaited<ReturnType<typeof generateTextToImageBatch>>
  try {
    if (isImageToImage && referenceSignedUrl) {
      batch = await generateImageToImageBatch({
        imageUrl: referenceSignedUrl,
        prompt: interpreted.prompt_for_image_model,
        negativePrompt: interpreted.negative_prompt,
        count: variationCount,
      })
    } else {
      batch = await generateTextToImageBatch({
        prompt: interpreted.prompt_for_image_model,
        negativePrompt: interpreted.negative_prompt,
        count: variationCount,
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

  return NextResponse.json({
    generationId,
    style_summary: interpreted.style_summary,
    variants,
  })
}
