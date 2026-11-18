import { HandInteractionSystem } from '../src/systems/interaction/HandInteractionSystem.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { hasPinchInteraction } from '../src/systems/interaction/updateXRInput.js'
import { computeThumbCurl } from '../src/systems/interaction/computeThumbCurl.js'
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
