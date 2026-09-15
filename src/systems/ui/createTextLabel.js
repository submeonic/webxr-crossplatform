import * as THREE from 'three'
import { FONT_DISPLAY, FONT_BODY } from './interfaceTheme.js'

// A world-up plane faces the viewer without inheriting camera roll like a Sprite.
export function createTextLabel(text, color = '#fff7ae', width = .58, height = .18, role = 'display') {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(160, Math.round(160 * width / height))
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  const geometry = new THREE.PlaneGeometry(1, 1)
  // Retain the existing public property name for callers.
  const sprite = new THREE.Mesh(geometry, material)
  sprite.scale.set(width, height, 1)
  const viewer = new THREE.Vector3()
  sprite.onBeforeRender = (_renderer, _scene, camera) => {
    // XR eye cameras have renderer-managed world matrices but no rig parent.
    // getWorldPosition() would recompute that matrix and erase locomotion mid-render.
    viewer.setFromMatrixPosition(camera.matrixWorld)
    sprite.up.set(0, 1, 0)
    sprite.lookAt(viewer)
    sprite.updateMatrixWorld(true)
  }
  function setLabel(value) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = `bold 92px ${role === 'body' ? FONT_BODY : FONT_DISPLAY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(value, canvas.width / 2, 80)
    texture.needsUpdate = true
  }
  setLabel(text)
  return { sprite, setLabel, dispose() { geometry.dispose(); texture.dispose(); material.dispose() } }
}
