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

/** Returns the server-side font stack for a given font value. Falls back to Arial. */
export function getServerFamily(fontValue: string): string {
  return FONTS.find((f) => f.value === fontValue)?.serverFamily ?? 'Arial, Helvetica, sans-serif'
}

/** Returns Google Fonts families that need to be imported (those with a googleFamily). */
export function getGoogleFontsFamilies(): string[] {
  return FONTS.filter((f) => f.googleFamily).map((f) => f.googleFamily)
}
