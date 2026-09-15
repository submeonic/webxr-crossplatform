import * as THREE from 'three'
import { createTextLabel } from './createTextLabel.js'

export function createCoordinateAxes(length = 2.2) {
  const group = new THREE.Group()
  group.name = 'OrbitalCoordinateAxes'
  const labels = []
  for (const [name, direction, color] of [
    ['X', new THREE.Vector3(1, 0, 0), '#f47575'],
    ['Y', new THREE.Vector3(0, 1, 0), '#86d98d'],
    ['Z', new THREE.Vector3(0, 0, -1), '#80b9ff'],
  ]) {
    // Cylinders retain a readable width in stereo, unlike implementation-dependent line widths.
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false })
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, length * 2, 8), material)
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 12), material)
    tip.position.copy(direction).multiplyScalar(length)
    tip.quaternion.copy(shaft.quaternion)
    const label = createTextLabel(name, color, 0.28, 0.28, 'body')
    label.sprite.position.copy(direction).multiplyScalar(length + 0.2)
    group.add(shaft, tip, label.sprite)
    labels.push(label)
  }
  return {
    group,
    dispose() {
      const materials = new Set()
      group.traverse(node => {
        if (node.isMesh && !labels.some(label => label.sprite === node)) { node.geometry.dispose(); materials.add(node.material) }
      })
      for (const material of materials) material.dispose()
      for (const label of labels) label.dispose()
    },
  }
}
