import * as THREE from 'three'
import { getDisplayAxisDirection } from '../../systems/ui/displayCoordinateSystem.js'

export const P_ORBITALS = Object.freeze([
  { id: '2px', label: '2px', axis: 'X' },
  { id: '2py', label: '2py', axis: 'Y' },
  { id: '2pz', label: '2pz', axis: 'Z' },
])

/** Selection changes the canonical cloud, never the parent inspection transform. */
export function selectOrbitalOrientation(target, id) {
  const orbital = P_ORBITALS.find(item => item.id === id)
  if (!orbital) return false
  target.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    getDisplayAxisDirection(orbital.axis),
  )
  return true
}
