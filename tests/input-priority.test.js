import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { updateXRInput } from '../src/systems/interaction/updateXRInput.js'
import { HandLocomotionSystem } from '../src/systems/locomotion/HandLocomotionSystem.js'

test('locomotion cancels an existing pinch, suspends pokes, and cannot be suppressed by new pinches', () => {
  const playerRig = new THREE.Group(), camera = new THREE.PerspectiveCamera()
  playerRig.add(camera)
  const hands = { left: { visible: true, fistActive: false },
    right: { visible: true, fistActive: true, joystickX: 0, joystickZ: 1, handedness: 'right' } }
  const gesture = { hands, update() {} }
  const locomotion = new HandLocomotionSystem({ playerRig, camera, gestureSystem: gesture })
  let activeDrag = true, cancelReason, handled = 0, panelOptions
  const dependencies = {
    deltaTime: 1 / 60, playerRig, handLocomotionGestureSystem: gesture,
    handLocomotionSystem: locomotion,
    handInteractionSystem: { update() {}, getState: () => ({ left: { visible: true, pinchActive: true, pinchStarted: true } }) },
    palmNavigationSystem: { update(_dt, options) { panelOptions = options; return {} } },
    activeSimulation: { isXRInteractionActive: () => activeDrag, handleInput() { handled++ } },
    resetActiveXRInteraction(reason) { cancelReason = reason; activeDrag = false },
  }
  const result = updateXRInput(dependencies)
  assert.equal(cancelReason, 'locomotion')
  assert.equal(handled, 0)
  assert.equal(result.locomotionState.usingHands, true)
  assert.ok(playerRig.position.z < 0)
  assert.equal(panelOptions.allowPoke, false)
  assert.ok(panelOptions.locomoting)
  for (const [x, z] of [[0, -1], [-1, 0], [1, 0]]) {
    hands.right.joystickX = x
    hands.right.joystickZ = z
    updateXRInput(dependencies)
    assert.ok(panelOptions.locomoting, 'backward travel and turning reposition the panel')
  }
  hands.right.joystickX = 0.1
  updateXRInput(dependencies)
  assert.equal(panelOptions.locomoting, false, 'a neutral fist inside the dead zone preserves the anchor')
  hands.right.fistActive = false
  const stopped = playerRig.position.clone()
  updateXRInput(dependencies)
  assert.ok(playerRig.position.equals(stopped), 'no residual locomotion during pinch')
  assert.equal(handled, 1)
  assert.equal(panelOptions.allowPoke, false)
})
