import * as THREE from 'three'

// User-facing axes are independent of Three.js world-space naming.
// The initial viewer looks toward Three.js -Z, so display +Y is forward.
export const DISPLAY_COORDINATE_AXES = Object.freeze([
  Object.freeze({ name: 'X', direction: Object.freeze([1, 0, 0]), color: '#f47575' }),
  Object.freeze({ name: 'Y', direction: Object.freeze([0, 0, -1]), color: '#86d98d' }),
  Object.freeze({ name: 'Z', direction: Object.freeze([0, 1, 0]), color: '#80b9ff' }),
])

export function getDisplayAxisDirection(name, target = new THREE.Vector3()) {
  const axis = DISPLAY_COORDINATE_AXES.find(item => item.name === name.toUpperCase())
  return axis ? target.fromArray(axis.direction) : null
}
