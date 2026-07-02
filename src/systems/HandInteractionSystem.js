import * as THREE from 'three'

const HANDEDNESS_BY_INDEX = ['left', 'right']

/*
  Pinch thresholds are in meters.

  Lower PINCH_START_DISTANCE = less sensitive.
  Higher PINCH_END_DISTANCE = easier to release without flicker.

  If it still starts too early, lower PINCH_START_DISTANCE to 0.015.
*/
const PINCH_START_DISTANCE = 0.008
const PINCH_END_DISTANCE = 0.018

/*
  Debounce:
  The fingers must be close for a few frames before pinch starts.
  This prevents accidental select when fingers are merely near each other.
*/
const PINCH_START_FRAMES = 3
const PINCH_END_FRAMES = 2

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

    pinchCandidateFrames: 0,
    pinchReleaseFrames: 0,

    pinchPosition: new THREE.Vector3(),
    previousPinchPosition: new THREE.Vector3(),
    pinchDelta: new THREE.Vector3(),

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

      handState.pinchCandidateFrames = 0
      handState.pinchReleaseFrames = 0

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

    const pinchDistance =
      TEMP_THUMB_POSITION.distanceTo(TEMP_INDEX_POSITION)

    handState.visible = true
    handState.pinchDistance = pinchDistance

    handState.previousPinchPosition.copy(handState.pinchPosition)
    handState.pinchPosition.copy(TEMP_PINCH_POSITION)

    handState.pinchDelta
      .copy(handState.pinchPosition)
      .sub(handState.previousPinchPosition)

    this.updatePinchState(handState, pinchDistance)
    this.updatePinchRay(handState)
  }

  updatePinchState(handState, pinchDistance) {
    if (!handState.pinchActive) {
      /*
        Not currently pinching:
        only start after several consecutive close frames.
      */
      if (pinchDistance <= PINCH_START_DISTANCE) {
        handState.pinchCandidateFrames++
      } else {
        handState.pinchCandidateFrames = 0
      }

      handState.pinchReleaseFrames = 0

      if (handState.pinchCandidateFrames >= PINCH_START_FRAMES) {
        handState.pinchActive = true
        handState.pinchStarted = true

        handState.pinchCandidateFrames = 0
        handState.pinchReleaseFrames = 0
      }

      return
    }

    /*
      Currently pinching:
      only release after the fingers separate past the larger end threshold.
    */
    if (pinchDistance >= PINCH_END_DISTANCE) {
      handState.pinchReleaseFrames++
    } else {
      handState.pinchReleaseFrames = 0
    }

    handState.pinchCandidateFrames = 0

    if (handState.pinchReleaseFrames >= PINCH_END_FRAMES) {
      handState.pinchActive = false
      handState.pinchEnded = true

      handState.pinchCandidateFrames = 0
      handState.pinchReleaseFrames = 0
    }
  }

  clearHandVisibility(handState) {
    handState.visible = false

    if (handState.pinchActive) {
      handState.pinchEnded = true
    }

    handState.pinchActive = false

    handState.pinchCandidateFrames = 0
    handState.pinchReleaseFrames = 0

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