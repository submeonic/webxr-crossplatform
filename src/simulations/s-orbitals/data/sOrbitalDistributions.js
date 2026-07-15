export const BOHR_RADIUS_ANGSTROM = 0.529177

/**
 * Hydrogen 1s radial shell probability density.
 *
 * radiusA0 is the radius in Bohr radii. This function already includes the
 * spherical-volume factor, so it is the correct PDF for sampling radii.
 */
export function radialProbability1s(radiusA0) {
  if (!Number.isFinite(radiusA0) || radiusA0 < 0) {
    return 0
  }

  return 4 * radiusA0 * radiusA0 * Math.exp(-2 * radiusA0)
}

/**
 * Hydrogen 2s radial shell probability density.
 *
 * P_2s(r) = (1 / 8) r^2 (2 - r)^2 exp(-r), with r measured in a0.
 * The radial node is exactly at r = 2a0.
 */
export function radialProbability2s(radiusA0) {
  if (!Number.isFinite(radiusA0) || radiusA0 < 0) {
    return 0
  }

  const nodeFactor = 2 - radiusA0

  return (
    0.125 *
    radiusA0 *
    radiusA0 *
    nodeFactor *
    nodeFactor *
    Math.exp(-radiusA0)
  )
}

export const RADIAL_PROBABILITY_1S_MAX = 4 / Math.exp(2)

const TWO_S_OUTER_PEAK_RADIUS_A0 = 3 + Math.sqrt(5)

export const RADIAL_PROBABILITY_2S_MAX =
  radialProbability2s(TWO_S_OUTER_PEAK_RADIUS_A0)
