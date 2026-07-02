import * as THREE from 'three'

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

/*
  Hydrogen 1s radial probability distribution.

  r is measured in Bohr radii a0.

  This is the radial shell probability density:
    P(r) ∝ 4r²e^(-2r)

  This is what we want for "how many detections fall between
  two spherical shells at radius r and r + dr".
*/
export function radialProbability1s(rA0) {
  return 4 * rA0 * rA0 * Math.exp(-2 * rA0)
}

export function sampleRadius1s({
  rMaxA0 = 5.0,
  random = Math.random,
} = {}) {
  /*
    f(r) = 4r²e^(-2r)
    Maximum occurs at r = 1.
    f(1) = 4/e²
  */
  const fMax = 4 / (Math.E * Math.E)

  for (;;) {
    const r = random() * rMaxA0
    const y = random() * fMax

    if (y <= radialProbability1s(r)) {
      return r
    }
  }
}

export function randomDirectionOnSphere(random = Math.random) {
  /*
    Uniform random direction on a sphere.
  */
  const u = random()
  const v = random()

  const theta = Math.acos(1 - 2 * u)
  const phi = 2 * Math.PI * v

  return new THREE.Vector3(
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta),
  )
}

export function generate1sSamples({
  count = 3000,
  rMaxA0 = 5.0,
  a0ToMeters = 2.0,
  seed = 12345,
} = {}) {
  const random = createSeededRandom(seed)

  const radiiA0 = new Float32Array(count)
  const positions = new Array(count)

  for (let i = 0; i < count; i++) {
    const rA0 = sampleRadius1s({
      rMaxA0,
      random,
    })

    const position = randomDirectionOnSphere(random)
      .multiplyScalar(rA0 * a0ToMeters)

    radiiA0[i] = rA0
    positions[i] = position
  }

  return {
    count,
    radiiA0,
    positions,
    rMaxA0,
    a0ToMeters,
  }
}