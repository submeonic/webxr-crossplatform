import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Vector3 } from 'three'
import { HandLocomotionGestureSystem } from '../src/systems/locomotion/HandLocomotionGestureSystem.js'
import { HandInteractionSystem } from '../src/systems/interaction/HandInteractionSystem.js'

function makeSource(handedness) {
  const source = {
    handedness, gap: 0.06, collapsed: false, missing: null,
    hand: { get: name => ({ name, source }) },
  }
  return source
}

function getJointPose({ name, source }) {
  if (name === source.missing) return null
  const position = new Vector3()
  if (!source.collapsed) {
    position.set(source.handedness === 'left' ? -0.18 : 0.18, 1.4, -0.30)
    switch (name) {
      case 'wrist': position.y -= 0.13; break
      case 'index-finger-phalanx-distal': position.y -= 0.02; break
      case 'thumb-phalanx-distal': position.y -= 0.02; position.x += source.gap; break
      case 'thumb-tip': position.x += source.gap; break
    }
  }
  return { transform: { position } }
}

function setup(inputSources) {
  const session = { inputSources, visibilityState: 'visible' }
  const gestures = new HandLocomotionGestureSystem({ xr: {
    getSession: () => session, getFrame: () => ({ getJointPose }), getReferenceSpace: () => ({}),
  } })
  const rig = new Group()
  rig.position.set(3, 0, -2)
  rig.rotation.y = Math.PI / 2
  rig.updateMatrixWorld()
  const input = new HandInteractionSystem(null, rig, gestures.hands)
  return { session, rig, hands: input.getState(), tick() { gestures.update(); input.update() } }
}

for (const side of ['right', 'left']) {
  test('a tracked ' + side + ' hand can pinch when the other hand disappears', () => {
    const tracked = makeSource(side)
    const other = makeSource(side === 'right' ? 'left' : 'right')
    const { session, hands, tick, rig } = setup([other, tracked])
    tick()
    other.collapsed = true
    tracked.gap = 0
    tick()
    assert.equal(hands[other.handedness].visible, false)
    assert.equal(hands[other.handedness].pinchStarted, false)
    assert.equal(hands[side].pinchStarted, true)
    const midpoint = getJointPose(tracked.hand.get('thumb-tip')).transform.position
    assert.ok(hands[side].pinchPosition.distanceTo(rig.localToWorld(midpoint)) < 1e-6)

    session.inputSources = [tracked]
    tick()
    assert.equal(hands[side].pinchActive, true)
    assert.equal(hands[side].pinchStarted, false)
    assert.equal(hands[other.handedness].pinchActive, false)
  })
}

test('a lost or replaced source must show an open hand before pinching again', () => {
  const source = makeSource('right')
  const { session, hands, tick } = setup([source])
  const hand = hands.right
  tick()
  source.gap = 0.01
  tick()
  assert.equal(hand.pinchStarted, true)
  source.missing = 'thumb-phalanx-distal'
  tick()
  assert.equal(hand.pinchEnded, true)
  assert.equal(hand.visible, false)
  tick()
  assert.equal(hand.pinchEnded, false)
  source.missing = null
  tick()
  assert.equal(hand.visible, true)
  assert.equal(hand.pinchDelta.lengthSq(), 0)
  assert.equal(hand.pinchActive, false)
  source.gap = 0.05
  tick()
  source.gap = 0.01
  tick()
  assert.equal(hand.pinchStarted, true)
  const replacement = makeSource('right')
  replacement.gap = 0.01
  session.inputSources = [replacement]
  tick()
  assert.equal(hand.pinchEnded, true)
  assert.equal(hand.pinchActive, false)
})
