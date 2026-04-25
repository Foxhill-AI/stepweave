/**
 * Home / marketplace product strips (Trending, Most Popular, Brand New):
 * grid layout with a capped initial row, then “View more” in steps.
 *
 * Override with env (client-safe): `NEXT_PUBLIC_HOME_SECTION_GRID_INITIAL`,
 * `NEXT_PUBLIC_HOME_SECTION_GRID_LOAD_MORE` (positive integers).
 */

function readPublicInt(name: string, fallback: number): number {
  if (typeof process === 'undefined') return fallback
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

export const HOME_SECTION_GRID_INITIAL_COUNT = readPublicInt(
  'NEXT_PUBLIC_HOME_SECTION_GRID_INITIAL',
  2
)

export const HOME_SECTION_GRID_LOAD_MORE_COUNT = readPublicInt(
  'NEXT_PUBLIC_HOME_SECTION_GRID_LOAD_MORE',
  2
)
