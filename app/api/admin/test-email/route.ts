import { NextRequest, NextResponse } from 'next/server'
import { sendAdminAlert } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/test-email
 *
 * Sends a test email to ADMIN_ALERT_EMAIL to verify Resend + domain config.
 * Protected by CRON_SECRET (same pattern as cron routes).
 * Hit from the browser: /api/admin/test-email?secret=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret) {
    const { searchParams } = new URL(request.url)
    const provided = searchParams.get('secret')
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await sendAdminAlert({
    subject: 'Step Weave email test',
    title: 'Email is working!',
    body: 'If you received this, your Resend domain and admin email address are configured correctly.',
    detail: `Sent at ${new Date().toUTCString()}`,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
