import * as THREE from 'three'

/*
  Pinch thresholds are in meters.

  Lower PINCH_START_DISTANCE = less sensitive.
  Higher PINCH_END_DISTANCE = easier to release without flicker.

  If it still starts too early, lower PINCH_START_DISTANCE to 0.015.
*/
const PINCH_START_DISTANCE = 0.018
const PINCH_END_DISTANCE = 0.040

/*
  Debounce:
  Start on the first close sample for immediate feedback. Release keeps a wider
  distance and a 100 ms hold to avoid flicker while holding a pinch.
*/
const PINCH_START_FRAMES = 1
const PINCH_RELEASE_SECONDS = 0.10

// In reference-space meters. Reject collapsed or detached joints without
// excluding genuine fingertip contact or a tracked hand close to the headset.
function hasFingerSegment(tip, distal) {
  const lengthSq = tip.distanceToSquared(distal)
  return lengthSq > 0.001 ** 2 && lengthSq < 0.07 ** 2
}

function hasPinchTracking(joints) {
  if (!joints) return false
  const wrist = joints.wrist
  const thumb = joints['thumb-tip']
  const index = joints['index-finger-tip']
  const palmSpanSq = wrist.distanceToSquared(joints['middle-finger-phalanx-proximal'])
  return palmSpanSq > 0.001 ** 2 && palmSpanSq < 0.20 ** 2 &&
    wrist.distanceToSquared(thumb) < 0.30 ** 2 &&
    wrist.distanceToSquared(index) < 0.30 ** 2 &&
    hasFingerSegment(thumb, joints['thumb-phalanx-distal']) &&
    hasFingerSegment(index, joints['index-finger-phalanx-distal'])
}

function createHandState(handedness) {
  return {
    handedness,

    visible: false,
    inputSource: null,
    pinchArmed: false,

    pinchActive: false,
    pinchStarted: false,
    pinchEnded: false,

    pinchDistance: Infinity,

    pinchCandidateFrames: 0,
    pinchReleaseFrames: 0,
    pinchReleaseSeconds: 0,

    pinchPosition: new THREE.Vector3(),
    previousPinchPosition: new THREE.Vector3(),
    pinchDelta: new THREE.Vector3(),

    pinchRay: new THREE.Ray(),
  }
}

export class HandInteractionSystem {
  constructor(camera, trackingRoot, trackedHands) {
    this.trackingRoot = trackingRoot
    this.trackedHands = trackedHands
    this.camera = camera

    this.hands = {
      left: createHandState('left'),
      right: createHandState('right'),
    }
  }

  update(deltaTime = 1 / 60) {
    this.updateHand(this.hands.left, this.trackedHands.left, deltaTime)
    this.updateHand(this.hands.right, this.trackedHands.right, deltaTime)
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
      this.clearHandVisibility(handState)
      handState.pinchStarted = false
      handState.pinchEnded = false
    }
  }

  updateHand(handState, trackedHand, deltaTime) {
    handState.pinchStarted = false
    handState.pinchEnded = false
    handState.pinchDelta.set(0, 0, 0)

    const joints = trackedHand.jointPositions
    if (!trackedHand.inputSource || !hasPinchTracking(joints)) {
      this.clearHandVisibility(handState)
      return
    }

    if (handState.inputSource !== trackedHand.inputSource) {
      this.clearHandVisibility(handState)
      handState.inputSource = trackedHand.inputSource
    }

    const thumb = joints['thumb-tip']
    const index = joints['index-finger-tip']
    handState.pinchDistance = thumb.distanceTo(index)
    handState.previousPinchPosition.copy(handState.pinchPosition)
    handState.pinchPosition.copy(thumb).add(index).multiplyScalar(0.5)
      .applyMatrix4(this.trackingRoot.matrixWorld)
    if (!handState.visible) handState.previousPinchPosition.copy(handState.pinchPosition)
    handState.pinchDelta.subVectors(handState.pinchPosition, handState.previousPinchPosition)
    handState.visible = true

    this.updatePinchState(handState, handState.pinchDistance, deltaTime)
    this.updatePinchRay(handState)
  }

  updatePinchState(handState, pinchDistance, deltaTime = 1 / 60) {
    // After tracking loss, a closed hand must open before it can start a drag.
    if (!handState.pinchArmed) {
      handState.pinchArmed = pinchDistance >= PINCH_END_DISTANCE
      return
    }

    if (!handState.pinchActive) {
      /*
        Not currently pinching:
        start on the first close sample.
      */
      if (pinchDistance <= PINCH_START_DISTANCE) {
        handState.pinchCandidateFrames++
      } else {
        handState.pinchCandidateFrames = 0
      }

      handState.pinchReleaseFrames = 0
      handState.pinchReleaseSeconds = 0

      if (handState.pinchCandidateFrames >= PINCH_START_FRAMES) {
        handState.pinchActive = true
        handState.pinchStarted = true

        handState.pinchCandidateFrames = 0
        handState.pinchReleaseFrames = 0
        handState.pinchReleaseSeconds = 0
      }

      return
    }

    /*
      Currently pinching:
      only release after the fingers separate past the larger end threshold.
    */
    if (pinchDistance >= PINCH_END_DISTANCE) {
      handState.pinchReleaseFrames++
      handState.pinchReleaseSeconds += Math.min(Math.max(deltaTime, 0), .05)
    } else {
      handState.pinchReleaseFrames = 0
      handState.pinchReleaseSeconds = 0
    }

    handState.pinchCandidateFrames = 0

    if (handState.pinchReleaseSeconds >= PINCH_RELEASE_SECONDS) {
      handState.pinchActive = false
      handState.pinchEnded = true

      handState.pinchCandidateFrames = 0
      handState.pinchReleaseFrames = 0
      handState.pinchReleaseSeconds = 0
    }
  }

  clearHandVisibility(handState) {
    handState.visible = false
    handState.inputSource = null
    handState.pinchArmed = false

    if (handState.pinchActive) {
      handState.pinchEnded = true
    }

    handState.pinchActive = false

    handState.pinchCandidateFrames = 0
    handState.pinchReleaseFrames = 0
    handState.pinchReleaseSeconds = 0

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
