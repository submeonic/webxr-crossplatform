import * as THREE from 'three'

const HANDEDNESS_BY_INDEX = ['left', 'right']

const PINCH_START_DISTANCE = 0.028
const PINCH_END_DISTANCE = 0.042

const TEMP_THUMB_POSITION = new THREE.Vector3()
const TEMP_INDEX_POSITION = new THREE.Vector3()
const TEMP_PINCH_POSITION = new THREE.Vector3()

function createHandState(handedness) {
  return {
    handedness,

    visible: false,

    pinchActive: false,
    pinchStarted: false,
    pinchEnded: false,

    pinchDistance: Infinity,
    pinchPosition: new THREE.Vector3(),
    previousPinchPosition: new THREE.Vector3(),
    pinchDelta: new THREE.Vector3(),

    /*
      This gives simulations a simple forward ray from the pinch point.
      It is useful later for pointing, grabbing, hovering, and ray-based UI.
    */
    pinchRay: new THREE.Ray(),
  }
}

export class HandInteractionSystem {
  constructor(renderer, camera) {
    this.renderer = renderer
    this.camera = camera

    this.hands = {
      left: createHandState('left'),
      right: createHandState('right'),
    }
  }

  update() {
    this.updateHand(0)
    this.updateHand(1)
  }

  resetTransientState() {
    for (const handState of Object.values(this.hands)) {
      handState.pinchStarted = false
      handState.pinchEnded = false
      handState.pinchDelta.set(0, 0, 0)
    }
  }

  reset() {
    for (const handState of Object.values(this.hands)) {
      handState.visible = false

      handState.pinchActive = false
      handState.pinchStarted = false
      handState.pinchEnded = false

      handState.pinchDistance = Infinity
      handState.previousPinchPosition.copy(handState.pinchPosition)
      handState.pinchDelta.set(0, 0, 0)
    }
  }

  updateHand(index) {
    const handedness = HANDEDNESS_BY_INDEX[index] ?? 'right'
    const handState = this.hands[handedness]

    handState.pinchStarted = false
    handState.pinchEnded = false
    handState.pinchDelta.set(0, 0, 0)

    const hand = this.renderer.xr.getHand(index)

    const thumbTip = hand?.joints?.['thumb-tip']
    const indexTip = hand?.joints?.['index-finger-tip']

    if (!thumbTip || !indexTip || !thumbTip.visible || !indexTip.visible) {
      this.clearHandVisibility(handState)
      return
    }

    thumbTip.getWorldPosition(TEMP_THUMB_POSITION)
    indexTip.getWorldPosition(TEMP_INDEX_POSITION)

    TEMP_PINCH_POSITION
      .copy(TEMP_THUMB_POSITION)
      .add(TEMP_INDEX_POSITION)
      .multiplyScalar(0.5)

    const pinchDistance = TEMP_THUMB_POSITION.distanceTo(TEMP_INDEX_POSITION)

    handState.visible = true
    handState.pinchDistance = pinchDistance

    handState.previousPinchPosition.copy(handState.pinchPosition)
    handState.pinchPosition.copy(TEMP_PINCH_POSITION)
    handState.pinchDelta
      .copy(handState.pinchPosition)
      .sub(handState.previousPinchPosition)

    const wasPinching = handState.pinchActive

    /*
      Hysteresis prevents pinching from flickering on/off
      when the fingers hover around the threshold.
    */
    if (!wasPinching && pinchDistance <= PINCH_START_DISTANCE) {
      handState.pinchActive = true
      handState.pinchStarted = true
    } else if (wasPinching && pinchDistance >= PINCH_END_DISTANCE) {
      handState.pinchActive = false
      handState.pinchEnded = true
    }

    this.updatePinchRay(handState)
  }

  clearHandVisibility(handState) {
    handState.visible = false

    if (handState.pinchActive) {
      handState.pinchEnded = true
    }

    handState.pinchActive = false
    handState.pinchDistance = Infinity
    handState.pinchDelta.set(0, 0, 0)
  }

  updatePinchRay(handState) {
    const direction = new THREE.Vector3(0, 0, -1)

    if (this.camera) {
      this.camera.getWorldDirection(direction)
    }

    handState.pinchRay.origin.copy(handState.pinchPosition)
    handState.pinchRay.direction.copy(direction).normalize()
  }

  getState() {
    return this.hands
  }
}