import * as THREE from 'three'

export function createTextLabel(text, color = '#fff7ae', width = 0.58, height = 0.18) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(160, Math.round(160 * width / height))
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(width, height, 1)
  function setLabel(value) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 92px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(value, canvas.width / 2, 80)
    texture.needsUpdate = true
  }
  setLabel(text)
  return { sprite, setLabel, dispose() { texture.dispose(); material.dispose() } }
}
