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

  let currentSamples = samples
  let revealedCount = samples.count
  const capacity = samples.count

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
    capacity,
  )

  baseMesh.name = 'BaseElectronSamples'
  baseMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  group.add(baseMesh)

  const highlightMesh = new THREE.InstancedMesh(
    electronGeometry,
    highlightMaterial,
    capacity,
  )

  highlightMesh.name = 'HighlightedElectronSamples'
  highlightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  highlightMesh.count = 0
  highlightMesh.visible = false

  group.add(highlightMesh)

  function setSamples(nextSamples) {
    if (!nextSamples || nextSamples.count > capacity) {
      throw new Error(
        `Orbital point cloud supports at most ${capacity} samples`,
      )
    }

    currentSamples = nextSamples
    revealedCount = currentSamples.count
    baseMesh.count = currentSamples.count

    for (let i = 0; i < currentSamples.count; i++) {
      const position = currentSamples.positions[i]

      TEMP_MATRIX.makeTranslation(
        position.x,
        position.y,
        position.z,
      )

      baseMesh.setMatrixAt(i, TEMP_MATRIX)
    }

    baseMesh.instanceMatrix.needsUpdate = true
    baseMesh.computeBoundingSphere()
    highlightMesh.count = 0
    highlightMesh.visible = false
  }

  function updateSelection(contains) {
    let highlightCount = 0

    for (let i = 0; i < revealedCount; i++) {
      if (contains(i)) {
        const position = currentSamples.positions[i]

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
    if (highlightCount) highlightMesh.computeBoundingSphere()

    return highlightCount
  }

  function updateHighlight(innerRadiusA0, outerRadiusA0) {
    return updateSelection(i => currentSamples.radiiA0[i]>=innerRadiusA0 && currentSamples.radiiA0[i]<outerRadiusA0)
  }

  function setRevealedCount(count) {
    revealedCount=Math.max(0,Math.min(currentSamples.count,Math.floor(count)))
    baseMesh.count=revealedCount
  }

  setSamples(samples)

  function dispose() {
    electronGeometry.dispose()
    baseMaterial.dispose()
    highlightMaterial.dispose()
  }

  return {
    group,
    baseMesh,
    highlightMesh,
    get samples() { return currentSamples },
    setSamples,
    updateHighlight,
    updateSelection,
    setRevealedCount,
    dispose,
  }
}
