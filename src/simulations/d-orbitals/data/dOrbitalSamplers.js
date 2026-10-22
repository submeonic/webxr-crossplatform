import * as THREE from 'three'
import { createSeededRandom } from '../../p-orbitals/data/pOrbitalSamplers.js'

export function radialProbability3d(r) {
  return r>=0 ? (2/3)**7/720*r**6*Math.exp(-2*r/3) : 0
}

export function generate3dSamples({count=1000,seed=3303,a0ToMeters=0.25,orbitalType='3d'}={}) {
  const radialRandom=createSeededRandom(seed)
  const angularRandom=createSeededRandom(seed^0x93a72c4b)
  const radiiA0=new Float32Array(count),positions=new Array(count)
  for(let i=0;i<count;i++) {
    let r=0
    for(let j=0;j<7;j++)r-=1.5*Math.log(Math.max(radialRandom(),1e-12))
    radiiA0[i]=r
    let x,y,z,weight
    do {
      z=1-2*angularRandom()
      const phi=2*Math.PI*angularRandom(), transverse=Math.sqrt(Math.max(0,1-z*z))
      x=transverse*Math.cos(phi);y=transverse*Math.sin(phi)
      weight=orbitalType==='3dz2' ? (3*z*z-1)**2/4 : 4*x*x*y*y
    } while(angularRandom()>weight)
    positions[i]=new THREE.Vector3(x,y,z).multiplyScalar(r*a0ToMeters)
  }
  return {count,radiiA0,positions,a0ToMeters,seed}
}
