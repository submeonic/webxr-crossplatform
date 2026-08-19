import * as THREE from 'three'

export function createSeededRandom(seed = 123456789) {
  let value = seed >>> 0

  return function random() {
    value += 0x6D2B79F5
    let t = value

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    )
  }
}

/*
 * Hydrogen 2p radial probability:
 *
 *   P_2p(r) = (1 / 24) r^4 exp(-r)
 *
 * with r measured in Bohr radii a0. This is the normalized
 * Gamma(k = 5, theta = 1) probability density.
 */
export function radialProbability2p(rA0) {
  if (rA0 < 0) return 0

  return (
    (1 / 24) *
    rA0 *
    rA0 *
    rA0 *
    rA0 *
    Math.exp(-rA0)
  )
}

function sampleGammaShape5(random) {
  let radius = 0

  for (let i = 0; i < 5; i++) {
    const u = Math.max(random(), 1e-12)
    radius += -Math.log(u)
  }

  return radius
}

export function sampleRadius2p({
  rMaxA0 = 12,
  random = Math.random,
} = {}) {
  for (;;) {
    const radiusA0 = sampleGammaShape5(random)

    if (radiusA0 <= rMaxA0) {
      return radiusA0
    }
  }
}

/*
 * Canonical 2px angular probability.
 *
 * |psi_2px|^2 is proportional to (x / r)^2.
 * Let mu = x / r. Then the normalized marginal density is
 * f(mu) = (3 / 2) mu^2 for -1 <= mu <= 1.
 */
export function randomDirection2px(
  random = Math.random,
) {
  const absoluteMu = Math.cbrt(random())
  const mu =
    random() < 0.5
      ? -absoluteMu
      : absoluteMu

  const phi = 2 * Math.PI * random()
  const transverseRadius = Math.sqrt(
    Math.max(0, 1 - mu * mu),
  )

  return new THREE.Vector3(
    mu,
    transverseRadius * Math.cos(phi),
    transverseRadius * Math.sin(phi),
  )
}

export function generate2pxSamples({
  count = 1000,
  rMaxA0 = 12,
  a0ToMeters = 0.25,
  seed = 2202,
} = {}) {
  const random = createSeededRandom(seed)
  const radiiA0 = new Float32Array(count)
  const positions = new Array(count)

  for (let i = 0; i < count; i++) {
    const radiusA0 = sampleRadius2p({
      rMaxA0,
      random,
    })

    const position = randomDirection2px(random)
      .multiplyScalar(
        radiusA0 * a0ToMeters,
      )

    radiiA0[i] = radiusA0
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
