import * as THREE from 'three'
import { getDisplayAxisDirection } from '../../systems/ui/displayCoordinateSystem.js'

export const D_ORBITALS=Object.freeze([
  {id:'3dxy',label:'3dxy',type:'3d'},
  {id:'3dxz',label:'3dxz',type:'3d'},
  {id:'3dyz',label:'3dyz',type:'3d'},
  {id:'3dx2-y2',label:'3dx²−y²',type:'3d'},
  {id:'3dz2',label:'3dz²',type:'3dz2'},
])
const displayBasis=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  getDisplayAxisDirection('X'),getDisplayAxisDirection('Y'),getDisplayAxisDirection('Z'),
))
export function selectDOrbitalOrientation(target,id) {
  if(!D_ORBITALS.some(o=>o.id===id))return false
  const rotation=new THREE.Quaternion()
  if(id==='3dxz')rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)
  if(id==='3dyz')rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),
  ))
  if(id==='3dx2-y2')rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/4)
  target.quaternion.copy(displayBasis).multiply(rotation)
  return true
}
