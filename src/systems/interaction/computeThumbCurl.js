import * as THREE from 'three'

/** Thumb has no intermediate phalanx. Require a complete, nondegenerate joint chain. */
export function computeThumbCurl(positions, startDegrees = 15, fullDegrees = 95) {
  const joints = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
    .map(name => positions[name])
  if (joints.some(joint => !joint)) return 1
  const segments = joints.slice(1).map((joint, i) => new THREE.Vector3().subVectors(joint, joints[i]))
  if (segments.some(segment => segment.lengthSq() < 1e-8)) return 1
  segments.forEach(segment => segment.normalize())
  const bend = Math.max(segments[0].angleTo(segments[1]), segments[1].angleTo(segments[2])) * 180 / Math.PI
  return THREE.MathUtils.clamp((bend - startDegrees) / Math.max(0.001, fullDegrees - startDegrees), 0, 1)
}
