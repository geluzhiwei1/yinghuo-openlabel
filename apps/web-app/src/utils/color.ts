/**
 * Set a CSS custom property on the document root.
 */
export function setProperty(name: string, value: string): void {
  document.documentElement.style.setProperty(name, value)
}

/**
 * Linearly interpolate between two hex colors.
 * @param color1 - Start color (hex)
 * @param color2 - End color (hex)
 * @param ratio - Blend factor 0.0 (全部 color1) → 1.0 (全部 color2)
 */
export function mix(color1: string, color2: string, ratio: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '')
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    }
  }

  const c1 = parse(color1)
  const c2 = parse(color2)
  const r = Math.round(c1.r + (c2.r - c1.r) * ratio)
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio)
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio)

  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}