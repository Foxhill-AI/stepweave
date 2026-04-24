/** Font definitions for the design tool text layer feature. */

export type FontDefinition = {
  label: string
  /** Value stored in PlacementTextLayer.fontFamily and used in CSS font-family. */
  value: string
  /** Google Fonts family name for the CSS import URL (empty = system font, no import needed). */
  googleFamily: string
  /** System font stack used for server-side SVG/canvas text rendering. */
  serverFamily: string
}

export const FONTS: FontDefinition[] = [
  {
    label: 'Roboto',
    value: 'Roboto',
    googleFamily: 'Roboto',
    serverFamily: 'Arial, Helvetica, sans-serif',
  },
  {
    label: 'Playfair Display',
    value: 'Playfair Display',
    googleFamily: 'Playfair+Display',
    serverFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    label: 'Oswald',
    value: 'Oswald',
    googleFamily: 'Oswald',
    serverFamily: '"Arial Narrow", Arial, sans-serif',
  },
  {
    label: 'Dancing Script',
    value: 'Dancing Script',
    googleFamily: 'Dancing+Script',
    serverFamily: 'cursive',
  },
  {
    label: 'Bebas Neue',
    value: 'Bebas Neue',
    googleFamily: 'Bebas+Neue',
    serverFamily: 'Impact, "Arial Narrow", sans-serif',
  },
  {
    label: 'Merriweather',
    value: 'Merriweather',
    googleFamily: 'Merriweather',
    serverFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    label: 'Anton',
    value: 'Anton',
    googleFamily: 'Anton',
    serverFamily: 'Impact, "Arial Narrow", sans-serif',
  },
  {
    label: 'Georgia',
    value: 'Georgia',
    googleFamily: '',
    serverFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    label: 'Impact',
    value: 'Impact',
    googleFamily: '',
    serverFamily: 'Impact, Charcoal, sans-serif',
  },
  {
    label: 'Courier New',
    value: 'Courier New',
    googleFamily: '',
    serverFamily: '"Courier New", Courier, monospace',
  },
]

export const DEFAULT_FONT = FONTS[0]

/** Bundled Noto TTF families registered for @napi-rs/canvas (server composites). */
export type ServerCanvasFontKind = 'sans' | 'serif' | 'mono'

const CANVAS_FAMILY_BY_KIND: Record<ServerCanvasFontKind, string> = {
  sans: 'StepweaveNotoSans',
  serif: 'StepweaveNotoSerif',
  mono: 'StepweaveNotoMono',
}

/**
 * Maps editor font to bundled Noto (OFL) used when rasterizing text for Printful composites.
 * UI still uses Google Fonts; server avoids missing system fonts / tofu glyphs on Vercel/Linux.
 */
export function getServerCanvasFontKind(fontValue: string): ServerCanvasFontKind {
  const serif = new Set(['Playfair Display', 'Merriweather', 'Georgia'])
  const mono = new Set(['Courier New'])
  if (mono.has(fontValue)) return 'mono'
  if (serif.has(fontValue)) return 'serif'
  return 'sans'
}

export function getServerCanvasFontFamilyName(kind: ServerCanvasFontKind): string {
  return CANVAS_FAMILY_BY_KIND[kind]
}

/** Returns the server-side font stack for a given font value. Falls back to Arial. */
export function getServerFamily(fontValue: string): string {
  return FONTS.find((f) => f.value === fontValue)?.serverFamily ?? 'Arial, Helvetica, sans-serif'
}

/** Returns Google Fonts families that need to be imported (those with a googleFamily). */
export function getGoogleFontsFamilies(): string[] {
  return FONTS.filter((f) => f.googleFamily).map((f) => f.googleFamily)
}
