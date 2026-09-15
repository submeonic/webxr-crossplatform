import * as THREE from 'three'

export const P_ORBITALS = Object.freeze([
  { id: '2px', label: '2px', axis: 'X' },
  { id: '2py', label: '2py', axis: 'Y' },
  { id: '2pz', label: '2pz', axis: 'Z' },
])

// Display +Z points away from the default viewer, along Three.js -Z.
/** Selection changes the canonical cloud, never the parent inspection transform. */
export function selectOrbitalOrientation(target, id) {
  if (!P_ORBITALS.some(item => item.id === id)) return false
  target.quaternion.identity()
  if (id === '2py') target.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  if (id === '2pz') target.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  return true
}
