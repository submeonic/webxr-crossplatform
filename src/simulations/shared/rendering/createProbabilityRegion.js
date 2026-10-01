import * as THREE from 'three'

import { getProbabilityRegionDefinition } from '../data/orbitalProbabilityRegions.js'
import { createIridescentRegionMaterial } from './createIridescentRegionMaterial.js'

export function createProbabilityRegion({
  orbitalType,
  a0ToMeters = 0.25,
  enclosedProbability = 0.9,
  color = 0xfff7ae,
  rimColor = 0xffffff,
  baseAlpha = 0.07,
  rimAlpha = 0.42,
  fresnelPower = 2.2,
  sphereWidthSegments = 72,
  sphereHeightSegments = 48,
  pMeridianSegments = 72,
  pRadialSegments = 72,
} = {}) {
  const definition = getProbabilityRegionDefinition(
    orbitalType,
    enclosedProbability,
  )
  const group = new THREE.Group()
  group.name = `${definition.orbitalType}ProbabilityRegion90`
  group.visible = false

  const material = createIridescentRegionMaterial({
    baseColor: color,
    rimColor,
    baseAlpha,
    rimAlpha,
    fresnelPower,
  })
  const geometries = []

  if (definition.orbitalType === '2p') {
    const geometry = create2pRegionGeometry({
      definition,
      a0ToMeters,
      meridianSegments: pMeridianSegments,
      radialSegments: pRadialSegments,
    })
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = '2pProbabilityRegionBoundary'
    mesh.renderOrder = 20
    group.add(mesh)
  } else {
    const geometry = new THREE.SphereGeometry(
      1,
      sphereWidthSegments,
      sphereHeightSegments,
    )
    geometries.push(geometry)

    definition.boundariesA0.forEach((radiusA0, index) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `${definition.orbitalType}ProbabilityRegionBoundary${index + 1}`
      mesh.scale.setScalar(radiusA0 * a0ToMeters)
      mesh.renderOrder = 20 + index
      group.add(mesh)
    })
  }

  return {
    group,
    material,
    definition,
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      material.dispose()
    },
  }
}

export function create2pRegionGeometry({
  definition = getProbabilityRegionDefinition('2p'),
  a0ToMeters = 0.25,
  meridianSegments = 72,
  radialSegments = 72,
} = {}) {
  const [innerA0, outerA0] = definition.boundariesA0
  const densityScale = 32 * Math.PI * definition.isovalue
  const positions = []
  const indices = []

  addLobe(1)
  addLobe(-1)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry

  function addLobe(sign) {
    const lobeStart = positions.length / 3
    positions.push(sign * innerA0 * a0ToMeters, 0, 0)

    for (let meridian = 1; meridian < meridianSegments; meridian++) {
      const fraction = meridian / meridianSegments
      const xA0 = THREE.MathUtils.lerp(innerA0, outerA0, fraction)
      const radiusA0 = Math.log(xA0 * xA0 / densityScale)
      const transverseA0 = Math.sqrt(Math.max(
        0,
        radiusA0 * radiusA0 - xA0 * xA0,
      ))

      for (let radial = 0; radial < radialSegments; radial++) {
        const angle = radial / radialSegments * Math.PI * 2
        positions.push(
          sign * xA0 * a0ToMeters,
          transverseA0 * Math.cos(angle) * a0ToMeters,
          transverseA0 * Math.sin(angle) * a0ToMeters,
        )
      }
    }

    const outerPole = positions.length / 3
    positions.push(sign * outerA0 * a0ToMeters, 0, 0)
    const firstRing = lobeStart + 1
    const lastRing = outerPole - radialSegments

    for (let radial = 0; radial < radialSegments; radial++) {
      const next = (radial + 1) % radialSegments
      indices.push(lobeStart, firstRing + radial, firstRing + next)

      for (let meridian = 0; meridian < meridianSegments - 2; meridian++) {
        const currentRing = firstRing + meridian * radialSegments
        const nextRing = currentRing + radialSegments
        const a = currentRing + radial
        const b = currentRing + next
        const c = nextRing + radial
        const d = nextRing + next
        indices.push(a, c, b, b, c, d)
      }

      indices.push(lastRing + next, lastRing + radial, outerPole)
    }
  }
}

