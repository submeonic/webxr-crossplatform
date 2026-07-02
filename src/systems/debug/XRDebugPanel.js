import * as THREE from 'three'

export class XRDebugPanel {
  constructor(camera) {
    this.camera = camera

    this.canvas = document.createElement('canvas')
    this.canvas.width = 1024
    this.canvas.height = 768

    this.ctx = this.canvas.getContext('2d')

    this.texture = new THREE.CanvasTexture(this.canvas)

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false
    })

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.0),
      this.material
    )

    this.mesh.position.set(0, -0.35, -1.6)
    this.mesh.renderOrder = 999

    camera.add(this.mesh)

    this.lines = []
  }

  setLines(lines) {
    this.lines = lines
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.fillStyle = 'white'
    this.ctx.font = '30px monospace'
    this.ctx.textBaseline = 'top'

    let y = 24

    for (const line of this.lines) {
      this.ctx.fillText(line, 24, y)
      y += 34
    }

    this.texture.needsUpdate = true
  }
}