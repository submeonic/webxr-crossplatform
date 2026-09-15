import * as THREE from 'three'
import { FONT_DISPLAY, FONT_BODY, INTERFACE_THEME as theme } from './interfaceTheme.js'

/** Content is shared with the web lesson; the panel belongs to the stationary presentation. */
export function createActivityPanel(activity, { width = 1.5, height = 1.05 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 840
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, 1200, 840)
  ctx.fillStyle = theme.activityFill
  ctx.fillRect(0, 0, 1200, 840)
  ctx.strokeStyle = theme.line
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, 1196, 836)
  ctx.fillStyle = theme.brand
  ctx.fillRect(0, 0, 7, 840)
  ctx.fillStyle = theme.muted
  ctx.font = `600 28px ${FONT_BODY}`
  ctx.fillText('GUIDED ACTIVITY', 48, 55)
  ctx.fillStyle = theme.brand
  ctx.font = `400 52px ${FONT_DISPLAY}`
  ctx.fillText(activity.title, 48, 116)

  function wrap(text, size) {
    ctx.font = `${size}px ${FONT_BODY}`
    const lines = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > 1040 && line) { lines.push(line); line = word }
      else line = next
    }
    if (line) lines.push(line)
    return lines
  }
  let size = 52, blocks
  do {
    blocks = activity.steps.map(step => wrap(step, size))
    if (blocks.reduce((height, lines) => height + lines.length * size * 1.35 + 24, 0) <= 620) break
    size -= 1
  } while (size > 24)
  let y = 182
  blocks.forEach((lines, index) => {
    ctx.font = `${size}px ${FONT_BODY}`
    ctx.fillStyle = theme.text
    ctx.fillText(`${index + 1}.`, 48, y)
    ctx.font = `${size}px ${FONT_BODY}`
    ctx.fillStyle = theme.text
    for (const line of lines) { ctx.fillText(line, 98, y); y += size * 1.35 }
    y += 24
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false })
  const geometry = new THREE.PlaneGeometry(width, height)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'GuidedActivityPanel'
  mesh.visible = false
  const position = new THREE.Vector3(), viewer = new THREE.Vector3()
  return {
    mesh,
    canvas,
    update(isXR, camera) {
      mesh.visible = isXR
      if (!isXR) return
      mesh.getWorldPosition(position)
      camera.getWorldPosition(viewer)
      viewer.y = position.y
      if (viewer.distanceToSquared(position) > 1e-6) mesh.lookAt(viewer)
    },
    dispose() { texture.dispose(); material.dispose(); geometry.dispose() },
  }
}
