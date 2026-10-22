import * as THREE from 'three'
import { coverageAt, REGION_MERIDIANS as M, REGION_AZIMUTHS as A, DZ2_RING_PROBABILITY } from '../data/probabilityCoverage.js'
import { createIridescentRegionMaterial } from './createIridescentRegionMaterial.js'

// Corresponding rings and poles across keyframes allow smooth, bounded updates.
// A dz² torus is a separate component, collapsed at its calculated birth threshold.
export function createCoverageRegion({ type='2p', a0ToMeters=0.25, color=0xea9fa2, rimColor=0xfff7ae }={}) {
  const group=new THREE.Group()
  group.name='AdjustableProbabilityEnclosure'
  const material=createIridescentRegionMaterial({baseColor:color,rimColor})
  const parts=[]
  let state=coverageAt(type,0.9)
  const root2=Math.SQRT1_2
  const lobe = (u,v,w) => addPart('lobe',{u,v,w})
  if (type==='2p') {
    lobe([1,0,0],[0,1,0],[0,0,1]); lobe([-1,0,0],[0,1,0],[0,0,1])
  } else if (type==='3d') {
    for (const sign of [-1,1]) {
      lobe([sign*root2,sign*root2,0],[-root2,root2,0],[0,0,1])
      lobe([sign*root2,-sign*root2,0],[root2,root2,0],[0,0,1])
    }
  } else {
    lobe([0,0,1],[1,0,0],[0,1,0]); lobe([0,0,-1],[1,0,0],[0,1,0])
    addPart('ring')
  }

  function addPart(kind,basis) {
    const rings=kind==='ring' ? M*2 : M+1
    const positions=new Float32Array(rings*(A+1)*3), indices=[]
    for(let m=0;m<rings-1;m++) for(let a=0;a<A;a++) {
      const i=m*(A+1)+a,j=i+A+1
      indices.push(i,j,i+1,i+1,j,j+1)
    }
    if (kind==='ring') for(let a=0;a<A;a++) {
      const i=(rings-1)*(A+1)+a
      indices.push(i,a,i+1,i+1,a,a+1)
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage))
    geometry.setIndex(indices)
    const mesh=new THREE.Mesh(geometry,material)
    mesh.name=kind==='ring' ? 'EquatorialRingBoundary' : 'ProbabilityLobeBoundary'
    mesh.renderOrder=20
    // Bounds are updated after morphing; never inherit the initially empty bound.
    group.add(mesh); parts.push({kind,basis,rings,geometry,mesh,frames:new Map()})
  }
  function cross(frame,m,a) {
    const quarter=A/4
    const wrapped=a%(2*quarter), mirrored=wrapped>quarter ? 2*quarter-wrapped : wrapped
    return frame.cross[(m-1)*(quarter+1)+mirrored]
  }
  function coordinates(part,frame,m,a) {
    const angle=a/A*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle)
    if(part.kind==='ring') {
      const upper=m<=M, index=upper ? m : 2*M-m
      const f=(1-Math.cos(Math.PI*index/M))/2
      const radius=frame.ringInner+(frame.ringOuter-frame.ringInner)*f
      const z=index===0||index===M ? 0 : frame.ring[index-1]*(upper?1:-1)
      return [radius*c,radius*s,z]
    }
    const f=(1-Math.cos(Math.PI*m/M))/2
    const u=frame.inner+(frame.outer-frame.inner)*f
    let t=0
    if(m>0&&m<M) {
      if(type==='2p') {
        const r=Math.log(u*u/(32*Math.PI*frame.isovalue))
        t=Math.sqrt(Math.max(0,r*r-u*u))
      } else t=type==='3d' ? cross(frame,m,a) : frame.polar[m-1]
    }
    const b=part.basis
    return [0,1,2].map(i=>b.u[i]*u+b.v[i]*t*c+b.w[i]*t*s)
  }
  function setProbability(value) {
    state=coverageAt(type,value)
    group.visible=state.probability>0
    if(!group.visible)return state
    for(const part of parts) {
      part.mesh.visible=part.kind!=='ring'||state.probability>DZ2_RING_PROBABILITY
      if(!part.mesh.visible)continue
      const positions=part.geometry.attributes.position.array
      for(const frame of [state.lower,state.upper]) {
        if(part.frames.has(frame))continue
        const values=new Float32Array(positions.length)
        let offset=0
        for(let m=0;m<part.rings;m++)for(let a=0;a<=A;a++) {
          const point=coordinates(part,frame,m,a)
          for(let i=0;i<3;i++)values[offset++]=point[i]*a0ToMeters
        }
        part.frames.set(frame,values)
      }
      // Only the neighboring keyframes remain resident, regardless of drag history.
      for(const frame of part.frames.keys())if(frame!==state.lower&&frame!==state.upper)part.frames.delete(frame)
      const lo=part.frames.get(state.lower),hi=part.frames.get(state.upper)
      for(let i=0;i<positions.length;i++)positions[i]=lo[i]+(hi[i]-lo[i])*state.mix
      part.geometry.attributes.position.needsUpdate=true
      part.geometry.computeVertexNormals()
      part.geometry.computeBoundingSphere()
    }
    return state
  }
  setProbability(0.9)
  return { group, material, setProbability, getState:()=>state,
    dispose(){ for(const part of parts)part.geometry.dispose();material.dispose() },
  }
}
