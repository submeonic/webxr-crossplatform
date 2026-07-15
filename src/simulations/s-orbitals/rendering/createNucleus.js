import * as THREE from 'three'

export function createNucleus({
  radiusMeters = 0.045,
  color = 0x4cff9a,
  emissive = 0x0a4424,
  emissiveIntensity = 0.8,
} = {}) {
  const geometry = new THREE.SphereGeometry(
    radiusMeters,
    32,
    24,
  )

const material = new THREE.MeshStandardMaterial({
  color,
  emissive,
  emissiveIntensity,

  transparent: false,
  opacity: 1,

  depthTest: true,
  depthWrite: true,
})

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'HydrogenNucleus'

  function dispose() {
    geometry.dispose()
    material.dispose()
  }

  return {
    mesh,
    geometry,
    material,
    dispose,
  }
}
