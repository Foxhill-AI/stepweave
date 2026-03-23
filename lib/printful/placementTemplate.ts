/** Row returned by GET /api/printful/products/[id]/templates */
export type PlacementTemplateRow = {
  placement: string
  label: string
  template_url: string
  /** Printfile / order dimensions (same as mockup `position` area). */
  area_width: number
  area_height: number
  /** From layout template — optional overlay alignment on template image (px). */
  template_width?: number
  template_height?: number
  print_area_top?: number
  print_area_left?: number
  print_area_width?: number
  print_area_height?: number
}
