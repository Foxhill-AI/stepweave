/** Font definitions for the design tool text layer feature. */

export type FontDefinition = {
  label: string
  /** Value stored in PlacementTextLayer.fontFamily and used in CSS font-family. */
  value: string
  /** Google Fonts family name for the CSS import URL (empty = system font, no import needed). */
  googleFamily: string
  /** System font stack used for server-side SVG/canvas text rendering. */
  serverFamily: string
  /**
   * Family name registered with @napi-rs/canvas for server-side rasterization.
   * Matches the name passed to GlobalFonts.registerFromPath() in compositeImages.ts.
   * Null = no dedicated TTF bundled, falls back to a Noto variant.
   */
  serverCanvasFamily: string | null
  /** TTF filename in lib/printful/fonts/ (null if not bundled). */
  serverCanvasFontFile: string | null
}

export const FONTS: FontDefinition[] = [
  {
    label: 'Roboto',
    value: 'Roboto',
    googleFamily: 'Roboto',
    serverFamily: 'Arial, Helvetica, sans-serif',
    serverCanvasFamily: 'StepweaveRoboto',
    serverCanvasFontFile: 'Roboto-Regular.ttf',
  },
  {
    label: 'Playfair Display',
    value: 'Playfair Display',
    googleFamily: 'Playfair+Display',
    serverFamily: 'Georgia, "Times New Roman", serif',
    serverCanvasFamily: 'StepweavePlayfairDisplay',
    serverCanvasFontFile: 'PlayfairDisplay-Regular.ttf',
  },
  {
    label: 'Oswald',
    value: 'Oswald',
    googleFamily: 'Oswald',
    serverFamily: '"Arial Narrow", Arial, sans-serif',
    serverCanvasFamily: 'StepweaveOswald',
    serverCanvasFontFile: 'Oswald-Regular.ttf',
  },
  {
    label: 'Dancing Script',
    value: 'Dancing Script',
    googleFamily: 'Dancing+Script',
    serverFamily: 'cursive',
    serverCanvasFamily: 'StepweaveDancingScript',
    serverCanvasFontFile: 'DancingScript-Regular.ttf',
  },
  {
    label: 'Bebas Neue',
    value: 'Bebas Neue',
    googleFamily: 'Bebas+Neue',
    serverFamily: 'Impact, "Arial Narrow", sans-serif',
    serverCanvasFamily: 'StepweaveBebasNeue',
    serverCanvasFontFile: 'BebasNeue-Regular.ttf',
  },
  {
    label: 'Merriweather',
    value: 'Merriweather',
    googleFamily: 'Merriweather',
    serverFamily: 'Georgia, "Times New Roman", serif',
    serverCanvasFamily: 'StepweaveMerriweather',
    serverCanvasFontFile: 'Merriweather-Regular.ttf',
  },
  {
    label: 'Anton',
    value: 'Anton',
    googleFamily: 'Anton',
    serverFamily: 'Impact, "Arial Narrow", sans-serif',
    serverCanvasFamily: 'StepweaveAnton',
    serverCanvasFontFile: 'Anton-Regular.ttf',
  },
  {
    label: 'Georgia',
    value: 'Georgia',
    googleFamily: '',
    serverFamily: 'Georgia, "Times New Roman", serif',
    serverCanvasFamily: null,
    serverCanvasFontFile: null,
  },
  {
    label: 'Impact',
    value: 'Impact',
    googleFamily: '',
    serverFamily: 'Impact, Charcoal, sans-serif',
    // Impact is a proprietary system font — no free TTF to bundle.
    // Anton is the closest open-source equivalent (same condensed bold style).
    // serverCanvasFontFile is null so registration is skipped (Anton already registered);
    // serverCanvasFamily points at Anton's registered family so it renders correctly.
    serverCanvasFamily: 'StepweaveAnton',
    serverCanvasFontFile: null,
  },
  {
    label: 'Courier New',
    value: 'Courier New',
    googleFamily: '',
    serverFamily: '"Courier New", Courier, monospace',
    serverCanvasFamily: null,
    serverCanvasFontFile: null,
  },
]

export const DEFAULT_FONT = FONTS[0]

/** Bundled Noto TTF families registered for @napi-rs/canvas (fallbacks). */
export type ServerCanvasFontKind = 'sans' | 'serif' | 'mono'

const NOTO_FAMILY_BY_KIND: Record<ServerCanvasFontKind, string> = {
  sans: 'StepweaveNotoSans',
  serif: 'StepweaveNotoSerif',
  mono: 'StepweaveNotoMono',
}

function getNotoFallbackKind(fontValue: string): ServerCanvasFontKind {
  const serif = new Set(['Playfair Display', 'Merriweather', 'Georgia'])
  const mono = new Set(['Courier New'])
  if (mono.has(fontValue)) return 'mono'
  if (serif.has(fontValue)) return 'serif'
  return 'sans'
}

/**
 * Returns the @napi-rs/canvas family name to use when rasterizing text for Printful composites.
 * Prefers the font-specific bundled TTF; falls back to matching Noto variant.
 */
export function getServerCanvasFontFamilyName(fontValue: string): string {
  const def = FONTS.find((f) => f.value === fontValue)
  if (def?.serverCanvasFamily) return def.serverCanvasFamily
  return NOTO_FAMILY_BY_KIND[getNotoFallbackKind(fontValue)]
}

/** @deprecated Use getServerCanvasFontFamilyName(fontValue) directly. */
export function getServerCanvasFontKind(fontValue: string): ServerCanvasFontKind {
  return getNotoFallbackKind(fontValue)
}

/** Returns the server-side font stack for a given font value. Falls back to Arial. */
export function getServerFamily(fontValue: string): string {
  return FONTS.find((f) => f.value === fontValue)?.serverFamily ?? 'Arial, Helvetica, sans-serif'
}

/** Returns Google Fonts families that need to be imported (those with a googleFamily). */
export function getGoogleFontsFamilies(): string[] {
  return FONTS.filter((f) => f.googleFamily).map((f) => f.googleFamily)
}
