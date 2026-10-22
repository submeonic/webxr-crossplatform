// Offline only: npm run generate:regions. No integration or root finding in XR.
// Angular quadrature integrates |Y|² dΩ; radial mass uses normalized Gamma CDFs.
import { writeFile } from 'node:fs/promises'
import { radialCdfGamma, DZ2_RING_PROBABILITY } from '../src/simulations/shared/data/hydrogenDensity.js'

const M = 48, A = 48
function bisect(fn, target, lo, hi, increasing = true) {
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2
    if ((fn(mid) < target) === increasing) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
function gauss(n) {
  const nodes = []
  for (let i = 0; i < n; i++) {
    let x = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp
    for (let k = 0; k < 16; k++) {
      let p = 1, prev = 0
      for (let j = 1; j <= n; j++) { const q = prev; prev = p; p = ((2*j-1)*x*prev-(j-1)*q)/j }
      dp = n * (x * p - prev) / (x*x-1)
      const next = x - p / dp
      if (Math.abs(next - x) < 1e-15) { x = next; break }
      x = next
    }
    nodes.push([x, 2 / ((1-x*x)*dp*dp)])
  }
  return nodes
}
const g64 = gauss(64), g256 = gauss(256)
function integrate(fn, lo, hi, nodes = g256) {
  if (hi <= lo) return 0
  const half = (hi-lo)/2, center = (hi+lo)/2
  let sum = 0
  for (const [x,w] of nodes) sum += w * fn(center + half*x)
  return sum * half
}
function radialTable(power, lambda, shape, scale) {
  const peak = power/lambda, logPeak = power*Math.log(peak)-lambda*peak
  const logF = r => power*Math.log(r)-lambda*r
  const roots = logRatio => {
    if (logRatio >= 0) return [peak, peak]
    const target = logPeak + logRatio
    return [bisect(logF,target,1e-20,peak), bisect(logF,target,peak,256,false)]
  }
  const size = 16384, maximum = 8, masses = [], volumes = []
  for (let i = 0; i <= size; i++) {
    const [ri,ro] = roots(-((i/size*maximum)**2))
    masses.push(radialCdfGamma(shape,scale,ro)-radialCdfGamma(shape,scale,ri))
    volumes.push((ro**3-ri**3)/3)
  }
  return { peak, roots,
    at(ratio, volume) {
      if (ratio >= 1) return 0
      const index = Math.min(size-1, Math.sqrt(-Math.log(Math.max(ratio,1e-28)))/maximum*size)
      const i = Math.floor(index), t = index-i, table = volume ? volumes : masses
      return table[i] + (table[i+1]-table[i])*t
    },
  }
}
const pRadial = radialTable(2,1,5,1), dRadial = radialTable(4,2/3,7,1.5)
function measure(type, t, volume = false) {
  const radial = type === '2p' ? pRadial : dRadial
  if (type === '2p') return 4*Math.PI*integrate(mu => {
    const angular = 3/(4*Math.PI)*mu*mu
    return radial.at(t/(mu*mu),volume)*(volume ? 1 : angular)
  },Math.sqrt(t),1)
  if (type === '3dz2') {
    const fn = mu => {
      const a = (3*mu*mu-1)**2
      return radial.at(4*t/a,volume)*(volume ? 1 : 5/(16*Math.PI)*a)
    }
    const polar = integrate(fn, Math.sqrt((1+2*Math.sqrt(t))/3),1)
    const equator = t < 0.25 ? integrate(fn,0,Math.sqrt((1-2*Math.sqrt(t))/3)) : 0
    return 4*Math.PI*(polar+equator)
  }
  return 8*integrate(mu => {
    const b = (1-mu*mu)**2
    const phiMin = Math.asin(Math.min(1,Math.sqrt(t/b)))/2
    return integrate(phi => {
      const a = b*Math.sin(2*phi)**2
      return radial.at(t/a,volume)*(volume ? 1 : 15/(16*Math.PI)*a)
    },phiMin,Math.PI/2-phiMin,g64)
  },0,Math.sqrt(1-Math.sqrt(t)),g64)
}
const round = value => Number(value.toPrecision(8))
function frame(type, probability) {
  const t = type === '3dz2' && probability === DZ2_RING_PROBABILITY
    ? 0.25 : bisect(value => measure(type,value),probability,1e-8,1,false)
  const radial = type === '2p' ? pRadial : dRadial
  const [inner,outer] = radial.roots(Math.log(t))
  const isovalue = type === '2p' ? Math.exp(-2)/(8*Math.PI)*t
    : type === '3d' ? 6**4*Math.exp(-4)/(13122*Math.PI)*t
      : 4*6**4*Math.exp(-4)/(39366*Math.PI)*t
  const result = { probability, isovalue, volume: measure(type,t,true), inner, outer }
  if (type === '3d') {
    result.cross = []
    for (let m = 1; m < M; m++) {
      const u = inner+(outer-inner)*(1-Math.cos(Math.PI*m/M))/2
      for (let a = 0; a <= A/4; a++) {
        const cosine = Math.cos(2*Math.PI*a/A)
        const density = transverse => {
          const r = Math.hypot(u,transverse)
          return (u*u-transverse*transverse*cosine*cosine)**2*Math.exp(-2*r/3)/(13122*Math.PI)
        }
        const maximum = Math.abs(cosine)>1e-10 ? u/Math.abs(cosine) : 120
        result.cross.push(bisect(density,isovalue,0,maximum,false))
      }
    }
  } else if (type === '3dz2') {
    result.polar = []
    for (let m = 1; m < M; m++) {
      const z = inner+(outer-inner)*(1-Math.cos(Math.PI*m/M))/2
      const density = r => (2*z*z-r*r)**2*Math.exp(-2*Math.hypot(z,r)/3)/(39366*Math.PI)
      result.polar.push(bisect(density,isovalue,0,Math.SQRT2*z,false))
    }
    const ringExists = t < 0.25 && probability > DZ2_RING_PROBABILITY
    const ringBounds = ringExists ? dRadial.roots(Math.log(4*t)) : [6,6]
    result.ringInner = ringBounds[0]; result.ringOuter = ringBounds[1]
    result.ring = []
    for (let m = 1; m < M; m++) {
      const r = ringBounds[0]+(ringBounds[1]-ringBounds[0])*(1-Math.cos(Math.PI*m/M))/2
      const density = z => (r*r-2*z*z)**2*Math.exp(-2*Math.hypot(r,z)/3)/(39366*Math.PI)
      result.ring.push(ringExists ? bisect(density,isovalue,0,r/Math.SQRT2,false) : 0)
    }
  }
  return JSON.parse(JSON.stringify(result,(_,value) => typeof value === 'number' ? round(value) : value))
}
const data = { meridians:M, azimuths:A, ringProbability:DZ2_RING_PROBABILITY }
for (const type of ['2p','3d','3dz2']) {
  const probabilities = Array.from({length:86},(_,i) => (i+5)/100)
  if (type === '3dz2') probabilities.push(DZ2_RING_PROBABILITY,...[0.00025,0.001,0.0025,0.005].map(d=>DZ2_RING_PROBABILITY+d))
  data[type] = probabilities.sort((a,b)=>a-b).map(p=>frame(type,p))
  console.log(type, '90% volume', data[type].at(-1).volume)
}
await writeFile(new URL('../src/simulations/shared/data/precomputedRegions.json',import.meta.url),JSON.stringify(data)+'\n')
