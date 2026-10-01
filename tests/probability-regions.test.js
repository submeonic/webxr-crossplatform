import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import {
  enclosedProbabilityForDefinition,
  getProbabilityRegionDefinition,
  probabilityDensity2px,
} from '../src/simulations/shared/data/orbitalProbabilityRegions.js'
import { create2pRegionGeometry } from '../src/simulations/shared/rendering/createProbabilityRegion.js'

test('analytic region definitions enclose 90 percent probability', () => {
  for (const orbitalType of ['1s', '2s', '2p']) {
    const definition = getProbabilityRegionDefinition(orbitalType)
    assert.ok(
      Math.abs(enclosedProbabilityForDefinition(definition) - 0.9) < 1e-8,
      `${orbitalType} region did not integrate to 90%`,
    )
  }
})

test('2s region preserves an inner component and a separate outer shell', () => {
  const definition = getProbabilityRegionDefinition('2s')
  const [innerOuter, shellInner, shellOuter] = definition.boundariesA0
  assert.equal(definition.componentCount, 2)
  assert.ok(innerOuter < 2)
  assert.ok(shellInner > 2)
  assert.ok(shellOuter > shellInner)
})

test('canonical 2p region geometry is finite, symmetric, and follows its isovalue', () => {
  const definition = getProbabilityRegionDefinition('2p')
  const geometry = create2pRegionGeometry({
    definition,
    a0ToMeters: 1,
    meridianSegments: 24,
    radialSegments: 24,
  })
  const positions = geometry.getAttribute('position')
  const box = new THREE.Box3().setFromBufferAttribute(positions)

  assert.ok(Array.from(positions.array).every(Number.isFinite))
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-5)
  assert.ok(Math.abs(box.min.y + box.max.y) < 1e-5)
  assert.ok(Math.abs(box.min.z + box.max.z) < 1e-5)

  for (let index = 0; index < positions.count; index += 37) {
    const position = new THREE.Vector3().fromBufferAttribute(positions, index)
    assert.ok(
      Math.abs(probabilityDensity2px(position.x, position.y, position.z) - definition.isovalue) < 2e-7,
    )
  }

  geometry.dispose()
})
