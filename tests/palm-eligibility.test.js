import { HandInteractionSystem } from '../src/systems/interaction/HandInteractionSystem.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { areAllFingersOpen, hasPinchInteraction } from '../src/systems/navigation/palmMenuEligibility.js'
import { computeThumbCurl } from '../src/systems/interaction/computeThumbCurl.js'
import { PalmNavigationSystem } from '../src/systems/navigation/PalmNavigationSystem.js'

const fingers = ['thumbCurl', 'indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl']
const openHand = () => ({ visible: true, ...Object.fromEntries(fingers.map(key => [key, 0])) })
test('menu requires every finger, including thumb, to be open and tracked', () => {
  assert.equal(areAllFingersOpen(openHand(), .18), true)
  for (const key of fingers) {
    for (const value of [.3, undefined, NaN]) {
      assert.equal(areAllFingersOpen({ ...openHand(), [key]: value }, .18), false)
    }
  }
  assert.equal(areAllFingersOpen({ ...openHand(), visible: false }, .18), false)
})
test('either hand reserves input from pinch candidate through release', () => {
  for (const side of ['left', 'right']) {
    for (const flag of ['pinchCandidateFrames', 'pinchStarted', 'pinchActive']) {
      assert.equal(hasPinchInteraction({ [side]: { visible: true, [flag]: 1 } }), true)
    }
  }
  assert.equal(hasPinchInteraction({ left: { visible: false, pinchActive: true } }), false)
  assert.equal(hasPinchInteraction({ left: { visible: true, pinchActive: false } }), false)
})
test('thumb chain distinguishes straight, bent and missing tracking', () => {
  const names = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
  const joints = Object.fromEntries(names.map((name, i) => [name, new THREE.Vector3(i * .02, 0, 0)]))
  assert.equal(computeThumbCurl(joints), 0)
  joints['thumb-tip'].set(.03, .02, 0)
  assert.equal(computeThumbCurl(joints), 1)
  delete joints['thumb-tip']
  assert.equal(computeThumbCurl(joints), 1)
})
test('busy input clears palm dwell and requires a fresh uninterrupted hold', () => {
  const opened = []
  const state = { hands: { left: { handedness: 'left', enterPose: true, candidateSeconds: .2 } },
    settings: { holdSeconds: .25 }, openForHand: hand => opened.push(hand) }
  const update = PalmNavigationSystem.prototype.updateCandidates.bind(state)
  update(.1, false)
  assert.equal(state.hands.left.candidateSeconds, 0)
  update(.1, true)
  assert.deepEqual(opened, [])
  update(.16, true)
  assert.deepEqual(opened, ['left'])
})

test('pinch starts immediately and requires sustained opening to release at either refresh rate', () => {
  for (const hz of [72, 90]) {
    const input = new HandInteractionSystem(null, null), hand = input.hands.left
    input.updatePinchState(hand, .017, 1 / hz)
    assert.equal(hand.pinchStarted, true)
    for (let i = 0; i < hz; i++) input.updatePinchState(hand, .035, 1 / hz)
    assert.equal(hand.pinchActive, true)
    input.updatePinchState(hand, .045, 1 / hz)
    input.updatePinchState(hand, .02, 1 / hz)
    assert.equal(hand.pinchReleaseSeconds, 0)
    for (let i = 0; i < Math.ceil(hz * .1) - 1; i++) input.updatePinchState(hand, .045, 1 / hz)
    assert.equal(hand.pinchActive, true)
    for (let i = 0; i < 2; i++) input.updatePinchState(hand, .045, 1 / hz)
    assert.equal(hand.pinchActive, false)
  }
})
