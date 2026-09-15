// Display: titles and prominent values. Body: instructions, axes and controls.
// Symbols and diagnostics intentionally use separate stacks for glyph coverage/alignment.
export const FONT_DISPLAY = '"Agency FB", "Arial Narrow", Arial, sans-serif'
export const FONT_BODY = '"Arial Narrow", Arial, sans-serif'
export const FONT_SYMBOL = 'Arial, sans-serif'
export const FONT_DEBUG = 'monospace'
export const INTERFACE_THEME = Object.freeze({
  background: '#121212',
  brand: '#fff7ae',
  text: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.65)',
  line: 'rgba(255, 255, 255, 0.14)',
  activityFill: 'rgba(255, 247, 174, 0.035)',
})

export async function prepareInterfaceTheme() {
  const style = document.documentElement.style
  style.setProperty('--font-display', FONT_DISPLAY)
  style.setProperty('--font-body', FONT_BODY)
  style.setProperty('--bg', INTERFACE_THEME.background)
  style.setProperty('--brand', INTERFACE_THEME.brand)
  // Canvas textures do not redraw automatically when a web font finishes loading.
  // Load both bundled Agency weights before creating any simulation or menu textures.
  if (document.fonts) {
    await Promise.allSettled([
      document.fonts.load('400 26px "Agency FB"'),
      document.fonts.load('700 34px "Agency FB"'),
    ])
    await document.fonts.ready
  }
}
