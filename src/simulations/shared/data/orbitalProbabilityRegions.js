const PI = Math.PI
const REGION_TARGET = 0.9
const ROOT_ITERATIONS = 72
const THRESHOLD_ITERATIONS = 64
const TWO_P_INTEGRATION_STEPS = 4096

const definitionCache = new Map()

export function probabilityDensity1s(radiusA0) {
  if (!Number.isFinite(radiusA0) || radiusA0 < 0) return 0
  return Math.exp(-2 * radiusA0) / PI
}

export function probabilityDensity2s(radiusA0) {
  if (!Number.isFinite(radiusA0) || radiusA0 < 0) return 0
  const nodeFactor = 2 - radiusA0
  return nodeFactor * nodeFactor * Math.exp(-radiusA0) / (32 * PI)
}

export function probabilityDensity2px(xA0, yA0, zA0) {
  const radiusA0 = Math.hypot(xA0, yA0, zA0)
  return xA0 * xA0 * Math.exp(-radiusA0) / (32 * PI)
}

export function radialCdf1s(radiusA0) {
  if (!(radiusA0 > 0)) return 0
  const r = radiusA0
  return 1 - Math.exp(-2 * r) * (1 + 2 * r + 2 * r * r)
}

export function radialCdf2s(radiusA0) {
  if (!(radiusA0 > 0)) return 0
  const r = radiusA0
  const lowerGamma2 = lowerGammaInteger(2, r)
  const lowerGamma3 = lowerGammaInteger(3, r)
  const lowerGamma4 = lowerGammaInteger(4, r)
  return (lowerGamma4 - 4 * lowerGamma3 + 4 * lowerGamma2) / 8
}

export function radialProbability2p(radiusA0) {
  if (!Number.isFinite(radiusA0) || radiusA0 < 0) return 0
  return radiusA0 ** 4 * Math.exp(-radiusA0) / 24
}

export function getProbabilityRegionDefinition(
  orbitalType,
  enclosedProbability = REGION_TARGET,
) {
  const normalizedType = normalizeOrbitalType(orbitalType)
  const cacheKey = `${normalizedType}:${enclosedProbability}`

  if (!definitionCache.has(cacheKey)) {
    const definition = normalizedType === '1s'
      ? solve1sRegion(enclosedProbability)
      : normalizedType === '2s'
        ? solve2sRegion(enclosedProbability)
        : solve2pRegion(enclosedProbability)

    definitionCache.set(cacheKey, Object.freeze(definition))
  }

  return definitionCache.get(cacheKey)
}

export function enclosedProbabilityForDefinition(definition) {
  if (definition.orbitalType === '1s') {
    return radialCdf1s(definition.boundariesA0[0])
  }

  if (definition.orbitalType === '2s') {
    const [innerOuter, shellInner, shellOuter] = definition.boundariesA0
    return radialCdf2s(innerOuter) +
      radialCdf2s(shellOuter) - radialCdf2s(shellInner)
  }

  return enclosedProbability2p(definition.isovalue)
}

function normalizeOrbitalType(orbitalType) {
  if (orbitalType === '1s' || orbitalType === '1s-orbital') return '1s'
  if (orbitalType === '2s' || orbitalType === '2s-orbital') return '2s'
  if (
    orbitalType === '2p' ||
    orbitalType === '2px' ||
    orbitalType === '2p-orbital'
  ) return '2p'

  throw new Error(`Unsupported probability-region orbital: ${orbitalType}`)
}

function solve1sRegion(target) {
  validateTarget(target)
  const radiusA0 = bisectIncreasing(
    radialCdf1s,
    target,
    0,
    20,
  )

  return {
    orbitalType: '1s',
    enclosedProbability: target,
    isovalue: probabilityDensity1s(radiusA0),
    boundariesA0: Object.freeze([radiusA0]),
    componentCount: 1,
  }
}

function solve2sRegion(target) {
  validateTarget(target)
  const maximumOuterDensity = probabilityDensity2s(4)
  let low = 0
  let high = maximumOuterDensity

  for (let iteration = 0; iteration < THRESHOLD_ITERATIONS; iteration++) {
    const threshold = (low + high) * 0.5
    const boundaries = get2sBoundaries(threshold)
    const probability = probability2sBetweenBoundaries(boundaries)

    if (probability > target) low = threshold
    else high = threshold
  }

  const isovalue = (low + high) * 0.5
  const boundariesA0 = get2sBoundaries(isovalue)

  return {
    orbitalType: '2s',
    enclosedProbability: target,
    isovalue,
    boundariesA0: Object.freeze(boundariesA0),
    componentCount: 2,
  }
}

function solve2pRegion(target) {
  validateTarget(target)
  const maximumDensity = axialDensity2p(2)
  let low = 0
  let high = maximumDensity

  for (let iteration = 0; iteration < THRESHOLD_ITERATIONS; iteration++) {
    const threshold = (low + high) * 0.5
    const probability = enclosedProbability2p(threshold)

    if (probability > target) low = threshold
    else high = threshold
  }

  const isovalue = (low + high) * 0.5
  const boundariesA0 = get2pAxialBoundaries(isovalue)

  return {
    orbitalType: '2p',
    enclosedProbability: target,
    isovalue,
    boundariesA0: Object.freeze(boundariesA0),
    componentCount: 2,
  }
}

function get2sBoundaries(threshold) {
  return [
    bisectDecreasing(probabilityDensity2s, threshold, 0, 2),
    bisectIncreasing(probabilityDensity2s, threshold, 2, 4),
    bisectDecreasing(probabilityDensity2s, threshold, 4, 40),
  ]
}

function probability2sBetweenBoundaries(boundaries) {
  const [innerOuter, shellInner, shellOuter] = boundaries
  return radialCdf2s(innerOuter) +
    radialCdf2s(shellOuter) - radialCdf2s(shellInner)
}

function axialDensity2p(radiusA0) {
  return radiusA0 * radiusA0 * Math.exp(-radiusA0) / (32 * PI)
}

function get2pAxialBoundaries(threshold) {
  return [
    bisectIncreasing(axialDensity2p, threshold, 0, 2),
    bisectDecreasing(axialDensity2p, threshold, 2, 40),
  ]
}

function enclosedProbability2p(threshold) {
  if (!(threshold > 0)) return 1
  const [minimumRadius, maximumRadius] = get2pAxialBoundaries(threshold)
  const scale = 32 * PI * threshold

  return integrateSimpson((radiusA0) => {
    const q = scale * Math.exp(radiusA0) /
      Math.max(radiusA0 * radiusA0, Number.EPSILON)

    if (q >= 1) return 0
    const minimumAbsoluteCosine = Math.sqrt(Math.max(0, q))
    const includedAngularProbability = 1 - minimumAbsoluteCosine ** 3
    return radialProbability2p(radiusA0) * includedAngularProbability
  }, minimumRadius, maximumRadius, TWO_P_INTEGRATION_STEPS)
}

function lowerGammaInteger(order, value) {
  let series = 1
  let term = 1

  for (let index = 1; index <= order; index++) {
    term *= value / index
    series += term
  }

  return factorial(order) * (1 - Math.exp(-value) * series)
}

function factorial(value) {
  let result = 1
  for (let index = 2; index <= value; index++) result *= index
  return result
}

function bisectIncreasing(fn, target, minimum, maximum) {
  let low = minimum
  let high = maximum

  for (let iteration = 0; iteration < ROOT_ITERATIONS; iteration++) {
    const midpoint = (low + high) * 0.5
    if (fn(midpoint) < target) low = midpoint
    else high = midpoint
  }

  return (low + high) * 0.5
}

function bisectDecreasing(fn, target, minimum, maximum) {
  let low = minimum
  let high = maximum

  for (let iteration = 0; iteration < ROOT_ITERATIONS; iteration++) {
    const midpoint = (low + high) * 0.5
    if (fn(midpoint) > target) low = midpoint
    else high = midpoint
  }

  return (low + high) * 0.5
}

function integrateSimpson(fn, minimum, maximum, requestedSteps) {
  const steps = requestedSteps % 2 === 0
    ? requestedSteps
    : requestedSteps + 1
  const width = (maximum - minimum) / steps
  let total = fn(minimum) + fn(maximum)

  for (let index = 1; index < steps; index++) {
    total += fn(minimum + index * width) * (index % 2 === 0 ? 2 : 4)
  }

  return total * width / 3
}

function validateTarget(target) {
  if (!(target > 0 && target < 1)) {
    throw new Error('Enclosed probability must be between 0 and 1')
  }
}

