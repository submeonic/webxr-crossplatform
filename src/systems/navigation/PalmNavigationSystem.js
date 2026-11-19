import * as THREE from 'three'
import { PalmNavigationMenu } from './PalmNavigationMenu.js'

const UP = new THREE.Vector3(0, 1, 0)
// Offset from eye height in the player's horizontal frame, in meters.
const OFFSET = new THREE.Vector3(-0.23, -0.28, -0.36)
const FACE_VIEWER = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(new THREE.Vector3(), OFFSET, UP),
)
const head = new THREE.Vector3()
const direction = new THREE.Vector3()
const orientation = new THREE.Quaternion()
const fingertip = new THREE.Vector3()
const localTip = new THREE.Vector3()
// Viewer translation in reference space is our proxy for room-scale walking.
const WALK_START_METERS = 0.24
const WALK_CONTINUE_METERS = 0.012
const WALK_PAUSE_SECONDS = 0.18
const CROUCH_VERTICAL_METERS = 0.06
// Half the remaining distance every 80 ms, independent of headset refresh rate.
const FOLLOW_HALF_LIFE = 0.08

export class PalmNavigationSystem {
  constructor({ renderer, scene, trackingRoot = scene, onNavigate, onExitXR, menuOptions }) {
    this.renderer = renderer
    this.trackingRoot = trackingRoot
    this.onNavigate = onNavigate
    this.onExitXR = onExitXR
    this.menu = new PalmNavigationMenu(trackingRoot, menuOptions)
    this.simulationItems = []
    this.simulationById = new Map()
    this.simulationIdByObject = new WeakMap()
    this.walkOrigin = new THREE.Vector3()
    this.targetPosition = new THREE.Vector3()
    this.targetRotation = new THREE.Quaternion()
    this.pointerPosition = new THREE.Vector3()
    this.state = { visible: false, pointerHandedness: null, activatedItem: null }
    this.reset()
  }

  setSimulations(simulations = {}) {
    this.simulationItems = []
    this.simulationById.clear()
    this.simulationIdByObject = new WeakMap()

    for (const [fallbackId, simulation] of Object.entries(simulations)) {
      if (!simulation) continue

      const metadata =
        simulation.metadata ??
        simulation.xrMenuMetadata ??
        {}

      const id = metadata.id ?? simulation.id ?? fallbackId
      const showInXRMenu = metadata.showInXRMenu ?? false

      if (!showInXRMenu) continue

      const item = {
        id,
        label:
          metadata.xrMenuLabel ??
          metadata.label ??
          simulation.xrMenuLabel ??
          id,
        order:
          metadata.xrMenuOrder ??
          simulation.xrMenuOrder ??
          Number.MAX_SAFE_INTEGER,
        kind: 'simulation',
        simulation,
      }

      this.simulationItems.push(item)
      this.simulationById.set(id, simulation)
      this.simulationIdByObject.set(simulation, id)
    }

    this.simulationItems.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label)
    })

    this.family='s'
    this.refreshContextActions()
  }

  setActiveSimulation(simulation) {
    const simulationId = simulation
      ? this.simulationIdByObject.get(simulation) ??
        simulation.metadata?.id ??
        simulation.id ??
        null
      : null

    this.activeSimulation = simulation
    this.family=simulation?.family??this.family??'s'
    this.menu.setActiveSimulationId(simulationId)
    this.refreshContextActions()
  }

  refreshContextActions() {
    const simulation=this.activeSimulation
    const family=this.family??'s'
    const available=this.simulationItems.filter(item=>(item.simulation.family??'s')===family)
    const choices=family==='s' ? available.map(item=>({
      id:item.id,label:item.label,kind:'action',group:'choices',active:item.simulation===simulation,
      onSelect:()=>this.navigateTo(item.simulation,item.id),
    })) : (simulation?.getMenuActions?.()??[]).filter(item=>item.group==='orientation').map(item=>({...item,group:'choices'}))
    const context=(simulation?.getMenuActions?.()??[])
      .filter(item=>item.id==='orbital-view-mode').map(item=>({...item,group:'context'}))
    const resample={id:'resample-measurements',label:'RESAMPLE',kind:'action',group:'footer',
      onSelect:()=>this.activeSimulation?.resampleMeasurements?.()}
    this.menu.setHeading(`ORBITALS · ${simulation?.getSelectedOrbital?.() ? (simulation.orbitalChoices.find(o=>o.id===simulation.getSelectedOrbital())?.label??simulation.label) : simulation?.label??'1s'}`)
    this.menu.setItems([
      ...['s','p','d'].map(id=>({id:`family-${id}`,label:id,kind:'tab',active:family===id,onSelect:()=>this.selectFamily(id)})),
      ...choices,...context,resample,{id:'exit-xr',label:'EXIT XR',kind:'exit',group:'footer'},
    ])
  }

  navigateTo(simulation,id=simulation.id) {
    this.onNavigate?.({id,simulation,source:'xr-panel'})
  }

  selectFamily(family) {
    if(family===this.family)return
    const first=this.simulationItems.find(item=>(item.simulation.family??'s')===family)
    if(!first)return
    const choice=first.simulation.orbitalChoices?.[0]
    if(choice)first.simulation.selectOrbital(choice.id)
    this.family=family
    this.navigateTo(first.simulation,first.id)
    this.refreshContextActions()
  }

  isVisible() {
    return this.state.visible
  }

  getState() {
    return this.state
  }

  updateTarget(transform, locomoting, deltaTime) {
    head.copy(transform.position)
    if (this.initialized && !locomoting) {
      this.secondsSinceTravel += deltaTime
      if (this.secondsSinceTravel >= WALK_PAUSE_SECONDS) this.walking = false

      const horizontal = Math.hypot(head.x - this.walkOrigin.x, head.z - this.walkOrigin.z)
      const vertical = Math.abs(head.y - this.walkOrigin.y)
      // Rebase during a crouch or stand so incidental forward lean does not
      // accumulate as travel. Keep the panel at its last full pose.
      if (vertical > CROUCH_VERTICAL_METERS && vertical > horizontal) {
        this.walkOrigin.copy(head)
        this.walking = false
        return
      }

      const threshold = this.walking ? WALK_CONTINUE_METERS : WALK_START_METERS
      if (horizontal < threshold) return
      this.walking = true
    } else {
      this.walking = false
    }

    // The rig supplies virtual translation and turn. In rig-local space the
    // tablet offset follows horizontal gaze, even when stepping backward or sideways.
    orientation.copy(transform.orientation)
    direction.set(0, 0, -1).applyQuaternion(orientation)
    if (Math.hypot(direction.x, direction.z) > 0.1) {
      this.yaw = Math.atan2(-direction.x, -direction.z)
    } else if (!this.initialized) {
      // Starting a session looking straight up/down has no projected forward.
      direction.set(1, 0, 0).applyQuaternion(orientation)
      this.yaw = Math.atan2(-direction.z, direction.x)
    }

    this.walkOrigin.copy(head)
    this.secondsSinceTravel = 0
    this.targetPosition.copy(OFFSET).applyAxisAngle(UP, this.yaw).add(head)
    this.targetRotation.setFromAxisAngle(UP, this.yaw).multiply(FACE_VIEWER)
  }

  updatePose(transform, locomoting, deltaTime) {
    this.updateTarget(transform, locomoting, deltaTime)
    const group = this.menu.group
    const settled = group.position.distanceToSquared(this.targetPosition) < 1e-8 &&
      1 - Math.abs(group.quaternion.dot(this.targetRotation)) < 1e-8
    if (!this.initialized || settled) {
      group.position.copy(this.targetPosition)
      group.quaternion.copy(this.targetRotation)
      this.initialized = true
    } else {
      // Walk thresholds gate the target only. Keep easing between accepted
      // samples, even after travel stops. Rig movement is inherited directly.
      const dt = Math.min(deltaTime, 0.05)
      const alpha = 1 - 2 ** (-dt / FOLLOW_HALF_LIFE)
      group.position.lerp(this.targetPosition, alpha)
      group.quaternion.slerp(this.targetRotation, alpha)
    }
    group.updateWorldMatrix(true, false)
  }

  update(deltaTime, { allowPoke = true, locomoting = false } = {}) {
    const xr = this.renderer.xr
    this.state.activatedItem = null
    if (!xr.isPresenting) {
      if (this.initialized) this.reset()
      return this.state
    }

    const frame = xr.getFrame()
    const referenceSpace = xr.getReferenceSpace()
    const pose = frame && referenceSpace && frame.getViewerPose(referenceSpace)
    if (!pose) {
      this.walking = false
      this.clearPointer()
      return this.state
    }

    this.updatePose(pose.transform, locomoting, deltaTime)
    this.state.visible = true
    this.menu.setVisible(true)
    if (!allowPoke) {
      this.clearPointer()
      return this.state
    }

    // Retain the approaching hand until it leaves. Never carry an armed press
    // from one hand to another, including after a tracking interruption.
    let side = null
    for (const source of xr.getSession()?.inputSources ?? []) {
      const tip = source.hand?.get('index-finger-tip')
      const joint = tip && frame.getJointPose(tip, referenceSpace)
      if (!joint) continue
      this.trackingRoot.localToWorld(fingertip.copy(joint.transform.position))
      this.menu.group.worldToLocal(localTip.copy(fingertip))
      if (!this.menu.containsPointer(localTip)) continue
      if (!side || source.handedness === this.state.pointerHandedness) {
        side = source.handedness
        this.pointerPosition.copy(fingertip)
      }
    }
    if (side !== this.state.pointerHandedness) this.clearPointer()
    this.state.pointerHandedness = side
    const item = this.menu.updatePointer(side ? this.pointerPosition : null)
    if (item) {
      this.state.activatedItem = item
      if (item.kind === 'exit') this.onExitXR?.()
      else if (item.kind === 'visibility') this.menu.setDimmed(!this.menu.dimmed)
      else {
        item.onSelect?.()
        this.refreshContextActions()
      }
    }
    return this.state
  }

  clearPointer() {
    this.menu.updatePointer(null)
    this.state.pointerHandedness = null
  }

  reset() {
    this.menu.setVisible(false)
    this.menu.setDimmed(false)
    this.initialized = false
    this.walking = false
    this.secondsSinceTravel = 0
    this.yaw = 0
    this.state.visible = false
    this.state.pointerHandedness = null
    this.state.activatedItem = null
  }

  dispose() {
    this.reset()
    this.menu.dispose()
  }
}
