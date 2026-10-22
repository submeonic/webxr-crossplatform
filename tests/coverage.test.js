import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { coverageAt, getCoverageFrames, probabilityAtVolume, probabilityDensity, DZ2_RING_PROBABILITY } from '../src/simulations/shared/data/probabilityCoverage.js'
import { generate3dSamples } from '../src/simulations/d-orbitals/data/dOrbitalSamplers.js'
import { generate2pxSamples } from '../src/simulations/p-orbitals/data/pOrbitalSamplers.js'
import { createCoverageRegion } from '../src/simulations/shared/rendering/createCoverageRegion.js'
import { selectDOrbitalOrientation } from '../src/simulations/d-orbitals/OrbitalSelection.js'
import { getDisplayAxisDirection } from '../src/systems/ui/displayCoordinateSystem.js'
import { revealedMeasurementCount } from '../src/simulations/shared/measurementReveal.js'

test('coverage tables agree with independent seeded measurement frequencies, including between keyframes',()=>{
  for(const type of ['2p','3d','3dz2']) {
    const samples=type==='2p' ? generate2pxSamples({count:80000,seed:725,rMaxA0:Infinity,a0ToMeters:1})
      : generate3dSamples({count:80000,seed:725,a0ToMeters:1,orbitalType:type})
    const densities=samples.positions.map(p=>probabilityDensity(type,p.x,p.y,p.z))
    for(const p of [.05,.135,.298,.301,.505,.9]) {
      const selected=coverageAt(type,p)
      const actual=densities.filter(d=>d>=selected.isovalue).length/samples.count
      assert.ok(Math.abs(actual-p)<.007,`${type} ${p}: observed ${actual}`)
    }
    if(type!=='2p') {
      const tail=Array.from(samples.radiiA0).filter(r=>r>12).length/samples.count
      assert.ok(tail>.30&&tail<.33,'3d radial tails must not be truncated at 12 a₀')
    }
  }
})

test('density and volume selection are monotone, bounded, and invert consistently',()=>{
  for(const type of ['2p','3d','3dz2']) {
    const frames=getCoverageFrames(type)
    for(let i=1;i<frames.length;i++) {
      assert.ok(frames[i].volume>frames[i-1].volume)
      assert.ok(frames[i].isovalue<frames[i-1].isovalue)
    }
    for(const p of [.05,.137,.29817893,.301,.507,.9]) {
      assert.ok(Math.abs(probabilityAtVolume(type,coverageAt(type,p).volume)-p)<1e-7)
    }
    assert.equal(coverageAt(type,0).isovalue,Infinity)
    assert.equal(coverageAt(type,0.01).probability,0)
    assert.equal(coverageAt(type,2).probability,.9)
  }
})

test('interpolated enclosure vertices follow the density threshold and volume, without bridging nodes',()=>{
  for(const type of ['2p','3d','3dz2']) {
    const region=createCoverageRegion({type,a0ToMeters:1})
    for(const p of [.05,.135,.299,.305,.505,.9]) {
      const state=region.setProbability(p)
      let totalVolume=0
      for(const mesh of region.group.children) {
        if(!mesh.visible)continue
        const positions=mesh.geometry.attributes.position,index=mesh.geometry.index
        const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
        let signedVolume=0
        for(let i=0;i<index.count;i+=3) {
          a.fromBufferAttribute(positions,index.getX(i));b.fromBufferAttribute(positions,index.getX(i+1));c.fromBufferAttribute(positions,index.getX(i+2))
          signedVolume+=a.dot(b.cross(c))/6
        }
        totalVolume+=Math.abs(signedVolume)
        for(let i=0;i<positions.count;i+=43) {
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i)
          const density=probabilityDensity(type,x,y,z)
          assert.ok(Number.isFinite(density))
          assert.ok(Math.abs(density/state.isovalue-1)<.003,`${type} ${p}: surface missed density`)
          if(type==='2p')assert.notEqual(x,0)
          if(type==='3d')assert.ok(Math.abs(x*y)>1e-7)
        }
      }
      assert.ok(Math.abs(totalVolume/state.volume-1)<.015,`${type} ${p}: mesh volume ${totalVolume}, model ${state.volume}`)
    }
    region.setProbability(0);assert.equal(region.group.visible,false);region.dispose()
  }
})

test('dz² ring appears continuously after the calculated topology event',()=>{
  const region=createCoverageRegion({type:'3dz2',a0ToMeters:1})
  const ring=region.group.getObjectByName('EquatorialRingBoundary')
  region.setProbability(DZ2_RING_PROBABILITY-0.0001);assert.equal(ring.visible,false)
  region.setProbability(DZ2_RING_PROBABILITY);assert.equal(ring.visible,false)
  region.setProbability(DZ2_RING_PROBABILITY+1e-7);assert.equal(ring.visible,true)
  ring.geometry.computeBoundingBox()
  assert.ok(ring.geometry.boundingBox.max.z<.001,'new ring must not pop in at finite thickness')
  region.setProbability(.4)
  assert.ok(ring.geometry.boundingSphere.radius>0)
  region.dispose()
})

test('d samplers preserve radial draws across shapes and reproduce analytic angular moments',()=>{
  const clover=generate3dSamples({count:50000,seed:19,a0ToMeters:1})
  const axial=generate3dSamples({count:50000,seed:19,a0ToMeters:1,orbitalType:'3dz2'})
  assert.deepEqual(clover.radiiA0,axial.radiiA0)
  const moments=samples=>samples.positions.reduce((sum,p)=>[sum[0]+p.x*p.x/p.lengthSq(),sum[1]+p.y*p.y/p.lengthSq(),sum[2]+p.z*p.z/p.lengthSq()],[0,0,0]).map(n=>n/samples.count)
  for(const [samples,expected] of [[clover,[3/7,3/7,1/7]],[axial,[5/21,5/21,11/21]]]) {
    moments(samples).forEach((m,i)=>assert.ok(Math.abs(m-expected[i])<.006))
    const mean=Array.from(samples.radiiA0).reduce((a,b)=>a+b,0)/samples.count
    assert.ok(Math.abs(mean-10.5)<.06)
  }
})

test('d orientation uses displayed coordinates and preserves radial distances',()=>{
  const root=new THREE.Group()
  for(const [id,canonical,axis] of [
    ['3dxy',[0,0,1],'Z'],['3dxz',[0,0,1],'Y'],['3dyz',[0,0,1],'X'],['3dz2',[0,0,1],'Z'],
  ]) {
    selectDOrbitalOrientation(root,id)
    const actual=new THREE.Vector3(...canonical).applyQuaternion(root.quaternion)
    assert.ok(Math.abs(actual.dot(getDisplayAxisDirection(axis)))>1-1e-8)
  }
  selectDOrbitalOrientation(root,'3dx2-y2')
  const lobe=new THREE.Vector3(Math.SQRT1_2,Math.SQRT1_2,0).applyQuaternion(root.quaternion)
  assert.ok(Math.abs(lobe.dot(getDisplayAxisDirection('Y')))>1-1e-8)
})

test('measurement reveal accelerates, completes at three seconds, and supports reduced motion',()=>{
  assert.equal(revealedMeasurementCount(0,1000),0)
  assert.ok(revealedMeasurementCount(.5,1000)<revealedMeasurementCount(1,1000))
  assert.ok(revealedMeasurementCount(1,1000)<100)
  assert.ok(1000-revealedMeasurementCount(2.5,1000)>revealedMeasurementCount(.5,1000))
  assert.equal(revealedMeasurementCount(3,1000),1000)
  assert.equal(revealedMeasurementCount(5,1000),1000)
  assert.equal(revealedMeasurementCount(0,1000,true),1000)
})
