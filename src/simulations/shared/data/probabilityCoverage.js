import tables from './precomputedRegions.json' with { type: 'json' }
import { probabilityDensity, DZ2_RING_PROBABILITY } from './hydrogenDensity.js'

export { DZ2_RING_PROBABILITY, probabilityDensity }
export const REGION_MERIDIANS = tables.meridians
export const REGION_AZIMUTHS = tables.azimuths
export const MIN_COVERAGE = 0.05
export const MAX_COVERAGE = 0.9

export function clampCoverage(value) {
  if (!Number.isFinite(value)) return 0
  return value < MIN_COVERAGE / 2 ? 0 : Math.max(MIN_COVERAGE, Math.min(MAX_COVERAGE,value))
}

export function getCoverageFrames(type) {
  const frames = tables[type]
  if (!Array.isArray(frames)) throw new Error(`Unsupported probability coverage: ${type}`)
  return frames
}

// Interpolate scalars, not topology. Ring birth has its own exact keyframe.
export function coverageAt(type, probability) {
  const frames = getCoverageFrames(type)
  probability = clampCoverage(probability)
  if (!probability) return { probability:0, isovalue:Infinity, volume:0, lower:frames[0], upper:frames[0], mix:0 }
  let lo = 0, hi = frames.length-1
  while (hi-lo>1) {
    const mid=(lo+hi)>>1
    if (frames[mid].probability<probability) lo=mid
    else hi=mid
  }
  const lower=frames[lo], upper=frames[hi]
  const mix=Math.max(0,Math.min(1,(probability-lower.probability)/(upper.probability-lower.probability)))
  return { probability, lower, upper, mix,
    isovalue:Math.exp(Math.log(lower.isovalue)*(1-mix)+Math.log(upper.isovalue)*mix),
    volume:lower.volume+(upper.volume-lower.volume)*mix,
  }
}

export function probabilityAtVolume(type, volume) {
  if (!(volume>0)) return 0
  const frames=getCoverageFrames(type)
  if (volume<frames[0].volume/2) return 0
  if (volume<=frames[0].volume) return MIN_COVERAGE
  for (let i=1;i<frames.length;i++) {
    if (volume<=frames[i].volume) {
      const a=frames[i-1], b=frames[i]
      return a.probability+(b.probability-a.probability)*(volume-a.volume)/(b.volume-a.volume)
    }
  }
  return MAX_COVERAGE
}
