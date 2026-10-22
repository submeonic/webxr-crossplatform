// Distances are in a₀; densities are in a₀⁻³. Real, normalized hydrogen states.
export function probabilityDensity(type, x, y, z) {
  const r = Math.hypot(x, y, z)
  if (type === '2p') return x * x * Math.exp(-r) / (32 * Math.PI)
  const decay = Math.exp(-2 * r / 3)
  if (type === '3dz2') {
    return (2 * z * z - x * x - y * y) ** 2 * decay / (39366 * Math.PI)
  }
  if (type === '3d') return 2 * x * x * y * y * decay / (6561 * Math.PI)
  throw new Error(`Unsupported density: ${type}`)
}

export const DZ2_RING_PROBABILITY = 0.29817893

export function radialCdfGamma(shape, scale, radius) {
  if (radius <= 0) return 0
  const x = radius / scale
  let term = 1, sum = 1
  for (let k = 1; k < shape; k++) { term *= x / k; sum += term }
  return Math.max(0, Math.min(1, 1 - Math.exp(-x) * sum))
}
