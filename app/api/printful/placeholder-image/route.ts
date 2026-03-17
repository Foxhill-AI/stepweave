import { NextResponse } from 'next/server'

/**
 * Serves a minimal white PNG so Printful Mockup Generator can use it as the
 * design image_url when generating reference mockups. Use as:
 * process.env.NEXT_PUBLIC_SITE_URL + '/api/printful/placeholder-image'
 * (must be publicly reachable by Printful).
 */
const WHITE_PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function GET() {
  const buffer = Buffer.from(WHITE_PNG_1X1, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
