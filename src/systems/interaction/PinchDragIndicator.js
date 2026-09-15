import * as THREE from 'three'
import { createTextLabel } from '../ui/createTextLabel.js'

/** World-space origin and smoothed pinch endpoint; hints appear only after axis lock. */
export class PinchDragIndicator {
  constructor(parent, camera, options = {}) {
    this.scene = parent
    this.camera = camera
    this.settings = { markerRadius: .009, endpointRadius: .007, lineRadius: .0015,
      lineLength: .11, symbolOffset: .025, color: 0xfff7ae, ...options }
    this.group = new THREE.Group()
    this.group.name = 'PinchDragIndicator'
    this.group.renderOrder = 10000
    this.group.visible = false
    parent.add(this.group)
    this.origin = new THREE.Vector3()
    this.endpoint = new THREE.Vector3()
    this.right = new THREE.Vector3(1, 0, 0)
    this.direction = new THREE.Vector3()
    this.originMarker = this.marker(this.settings.markerRadius, 0xffffff)
    this.endpointMarker = this.marker(this.settings.endpointRadius, this.settings.color)
    this.displacementSegment = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8),
      new THREE.MeshBasicMaterial({ color: this.settings.color, transparent: true, depthTest: false, depthWrite: false }))
    this.guideSegment = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .22,
        depthTest: false, depthWrite: false }))
    this.guideSegment.renderOrder = 999
    this.guideSegment.visible = false
    this.group.add(this.guideSegment)
    this.displacementSegment.renderOrder = 1000
    this.group.add(this.originMarker, this.endpointMarker, this.displacementSegment)
    this.labels = ['+', '−', '>', '<'].map(text => {
      const label = createTextLabel(text, '#ffffff', .045, .045, 'body')
      label.sprite.material.depthTest = false
      label.sprite.renderOrder = 1002
      this.group.add(label.sprite)
      return label
    })
  }
  marker(radius, color) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false }))
    mesh.renderOrder = 1001
    return mesh
  }
  show({ originWorldPosition, rightVector, pending = false }) {
    this.origin.copy(originWorldPosition)
    this.right.copy(rightVector)
    this.originMarker.position.copy(this.origin)
    const distance = this.settings.lineLength + this.settings.symbolOffset
    const up = new THREE.Vector3(0, 1, 0)
    const directions = [up, up.clone().negate(), this.right, this.right.clone().negate()]
    this.labels.forEach((label, i) => label.sprite.position.copy(this.origin).addScaledVector(directions[i], distance))
    this.setAxis(pending ? null : 'both')
    this.group.visible = true
    this.update({ currentWorldPosition: originWorldPosition })
  }
  setAxis(axis) {
    this.guideSegment.visible = axis === 'vertical' || axis === 'horizontal'
    if (this.guideSegment.visible) {
      const direction = axis === 'vertical' ? new THREE.Vector3(0, 1, 0) : this.right
      this.guideSegment.position.copy(this.origin)
      this.guideSegment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      this.guideSegment.scale.set(this.settings.lineRadius * .7,
        2 * (this.settings.lineLength + this.settings.symbolOffset), this.settings.lineRadius * .7)
    }
    this.labels.forEach((label, i) => {
      label.sprite.visible = axis === 'both' || (axis === 'vertical' && i < 2) || (axis === 'horizontal' && i >= 2)
    })
  }
  update({ currentWorldPosition, atMinimum = false, atMaximum = false } = {}) {
    if (!this.group.visible || !currentWorldPosition) return
    this.endpoint.copy(currentWorldPosition)
    this.endpointMarker.position.copy(this.endpoint)
    this.direction.copy(this.endpoint).sub(this.origin)
    const length = this.direction.length()
    const segment = this.displacementSegment
    segment.visible = length > 1e-6
    if (segment.visible) {
      segment.position.copy(this.origin).add(this.endpoint).multiplyScalar(.5)
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.direction.normalize())
      segment.scale.set(this.settings.lineRadius, length, this.settings.lineRadius)
    }
    const radius = this.settings.lineLength + this.settings.symbolOffset
    this.labels.forEach((label, i) => {
      const distance = label.sprite.position.distanceTo(this.endpoint)
      label.sprite.material.opacity = (i === 0 && atMaximum) || (i === 1 && atMinimum)
        ? .2 : THREE.MathUtils.lerp(.2, .95, THREE.MathUtils.clamp(distance / radius, 0, 1))
    })
  }
  hide() { this.group.visible = false }
  dispose() {
    this.scene.remove(this.group)
    for (const mesh of [this.originMarker, this.endpointMarker, this.displacementSegment, this.guideSegment]) {
      mesh.geometry.dispose(); mesh.material.dispose()
    }
    this.labels.forEach(label => label.dispose())
  }
}
