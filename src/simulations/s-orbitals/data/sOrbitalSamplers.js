import * as THREE from 'three'

import {
  RADIAL_PROBABILITY_1S_MAX,
  RADIAL_PROBABILITY_2S_MAX,
  radialProbability1s,
  radialProbability2s,
} from './sOrbitalDistributions.js'

export function createSeededRandom(seed = 123456789) {
  let value = seed >>> 0

  return function random() {
    value += 0x6D2B79F5

    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sampleRadiusFromDistribution({
  radialProbability,
  probabilityMaximum,
  maxRadiusA0,
  random = Math.random,
} = {}) {
  if (typeof radialProbability !== 'function') {
    throw new Error(
      'sampleRadiusFromDistribution requires radialProbability',
    )
  }

  if (!(probabilityMaximum > 0)) {
    throw new Error(
      'sampleRadiusFromDistribution requires a positive probabilityMaximum',
    )
  }

  if (!(maxRadiusA0 > 0)) {
    throw new Error(
      'sampleRadiusFromDistribution requires maxRadiusA0 > 0',
    )
  }

  for (;;) {
    const radiusA0 = random() * maxRadiusA0
    const testValue = random() * probabilityMaximum

    if (testValue <= radialProbability(radiusA0)) {
      return radiusA0
    }
  }
}

export function sampleRadius1s({
  rMaxA0,
  maxRadiusA0 = rMaxA0 ?? 5,
  random = Math.random,
} = {}) {
  return sampleRadiusFromDistribution({
    radialProbability: radialProbability1s,
    probabilityMaximum: RADIAL_PROBABILITY_1S_MAX,
    maxRadiusA0,
    random,
  })
}

export function sampleRadius2s({
  rMaxA0,
  maxRadiusA0 = rMaxA0 ?? 12,
  random = Math.random,
} = {}) {
  return sampleRadiusFromDistribution({
    radialProbability: radialProbability2s,
    probabilityMaximum: RADIAL_PROBABILITY_2S_MAX,
    maxRadiusA0,
    random,
  })
}

export function randomDirectionOnSphere(random = Math.random) {
  const z = 1 - 2 * random()
  const phi = 2 * Math.PI * random()
  const radialDistance = Math.sqrt(Math.max(0, 1 - z * z))

  return new THREE.Vector3(
    radialDistance * Math.cos(phi),
    radialDistance * Math.sin(phi),
    z,
  )
}

export function generateSOrbitalSamples({
  count = 1800,
  seed = 12345,
  maxRadiusA0,
  a0ToMeters = 0.25,
  sampleRadius,
} = {}) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(
      'generateSOrbitalSamples requires a positive integer count',
    )
  }

  if (!(maxRadiusA0 > 0)) {
    throw new Error(
      'generateSOrbitalSamples requires maxRadiusA0 > 0',
    )
  }

  if (typeof sampleRadius !== 'function') {
    throw new Error(
      'generateSOrbitalSamples requires a sampleRadius function',
    )
  }

  const random = createSeededRandom(seed)
  const radiiA0 = new Float32Array(count)
  const positions = new Array(count)

  for (let index = 0; index < count; index++) {
    const radiusA0 = sampleRadius({
      maxRadiusA0,
      random,
    })

    const position = randomDirectionOnSphere(random)
      .multiplyScalar(radiusA0 * a0ToMeters)

    radiiA0[index] = radiusA0
    positions[index] = position
  }

  return {
    count,
    radiiA0,
    positions,
    rMaxA0: maxRadiusA0,
    sampleMaxRadiusA0: maxRadiusA0,
    a0ToMeters,
    seed,
  }
}

export function generate1sSamples({
  count = 1800,
  seed = 1001,
  rMaxA0,
  maxRadiusA0 = rMaxA0 ?? 5,
  a0ToMeters = 0.25,
} = {}) {
  return generateSOrbitalSamples({
    count,
    seed,
    maxRadiusA0,
    a0ToMeters,
    sampleRadius: sampleRadius1s,
  })
}

export function generate2sSamples({
  count = 1800,
  seed = 2002,
  rMaxA0,
  maxRadiusA0 = rMaxA0 ?? 12,
  a0ToMeters = 0.25,
} = {}) {
  return generateSOrbitalSamples({
    count,
    seed,
    maxRadiusA0,
    a0ToMeters,
    sampleRadius: sampleRadius2s,
  })
}
