import * as THREE from 'three'

const TEMP_MATRIX = new THREE.Matrix4()

export function createOrbitalPointCloud({
  samples,
  electronRadius = 0.025,
  baseColor = 0xeadfad,
  baseOpacity = 0.2,
  highlightColor = 0xfff1bf,
  highlightOpacity = 0.9,
} = {}) {
  if (!samples) {
    throw new Error('createOrbitalPointCloud requires samples')
  }

  const group = new THREE.Group()
  group.name = 'OrbitalPointCloud'

  const electronGeometry = new THREE.SphereGeometry(
    electronRadius,
    10,
    8,
  )

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    transparent: true,
    opacity: baseOpacity,
    roughness: 0.65,
    metalness: 0.0,
    depthWrite: false,
  })

  const highlightMaterial = new THREE.MeshStandardMaterial({
    color: highlightColor,
    transparent: true,
    opacity: highlightOpacity,
    roughness: 0.55,
    metalness: 0.0,
    depthWrite: false,
  })

  const baseMesh = new THREE.InstancedMesh(
    electronGeometry,
    baseMaterial,
    samples.count,
  )

  baseMesh.name = 'BaseElectronSamples'
  baseMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  for (let i = 0; i < samples.count; i++) {
    const position = samples.positions[i]

    TEMP_MATRIX.makeTranslation(
      position.x,
      position.y,
      position.z,
    )

    baseMesh.setMatrixAt(i, TEMP_MATRIX)
  }

  baseMesh.instanceMatrix.needsUpdate = true
  group.add(baseMesh)

  const highlightMesh = new THREE.InstancedMesh(
    electronGeometry,
    highlightMaterial,
    samples.count,
  )

  highlightMesh.name = 'HighlightedElectronSamples'
  highlightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  highlightMesh.count = 0
  highlightMesh.visible = false

  group.add(highlightMesh)

  function updateHighlight(innerRadiusA0, outerRadiusA0) {
    let highlightCount = 0

    for (let i = 0; i < samples.count; i++) {
      const radiusA0 = samples.radiiA0[i]

      if (
        radiusA0 >= innerRadiusA0 &&
        radiusA0 < outerRadiusA0
      ) {
        const position = samples.positions[i]

        TEMP_MATRIX.makeTranslation(
          position.x,
          position.y,
          position.z,
        )

        highlightMesh.setMatrixAt(highlightCount, TEMP_MATRIX)

        highlightCount++
      }
    }

    highlightMesh.count = highlightCount
    highlightMesh.visible = highlightCount > 0
    highlightMesh.instanceMatrix.needsUpdate = true

    return highlightCount
  }

  function dispose() {
    electronGeometry.dispose()
    baseMaterial.dispose()
    highlightMaterial.dispose()
  }

  return {
    group,
    baseMesh,
    highlightMesh,
    samples,
    updateHighlight,
    dispose,
  }
}