import * as THREE from 'three'
const UP = new THREE.Vector3(0, 1, 0)
const normal = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3()
const horizontal = new THREE.Vector3(), matrix = new THREE.Matrix4()

/** Hand position anchors the panel; viewer direction controls facing, independent of palm roll. */
export function getPalmPanelPose({ palmCenter, viewerPosition, upOffset = 0.15,
  forwardOffset = 0.08, maxTiltDegrees = 20, fallbackQuaternion }, position, quaternion) {
  horizontal.copy(viewerPosition).sub(palmCenter)
  horizontal.y = 0
  if (horizontal.lengthSq() < 1e-6) {
    horizontal.set(0, 0, 1)
    if (fallbackQuaternion) horizontal.applyQuaternion(fallbackQuaternion)
    horizontal.y = 0
    if (horizontal.lengthSq() < 1e-6) horizontal.set(0, 0, 1)
  }
  horizontal.normalize()
  position.copy(palmCenter).addScaledVector(UP, upOffset).addScaledVector(horizontal, forwardOffset)
  normal.copy(viewerPosition).sub(position)
  const flatDistance = Math.max(0.001, Math.hypot(normal.x, normal.z))
  const tilt = THREE.MathUtils.clamp(Math.atan2(normal.y, flatDistance),
    -THREE.MathUtils.degToRad(maxTiltDegrees), THREE.MathUtils.degToRad(maxTiltDegrees))
  normal.copy(horizontal).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt))
  right.crossVectors(UP, normal).normalize()
  up.crossVectors(normal, right).normalize()
  matrix.makeBasis(right, up, normal)
  quaternion.setFromRotationMatrix(matrix)
}
