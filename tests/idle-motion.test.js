import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { OrbitCameraController } from '../src/systems/navigation/OrbitCameraController.js'

test('web camera orbit waits after load and resumes after interaction', () => {
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  const camera = new THREE.PerspectiveCamera()
  const controller = new OrbitCameraController(camera, {
    target: new THREE.Group(),
    targetOffset: new THREE.Vector3(),
    defaultDistance: 5,
    idleOrbitDelay: 2,
    idleOrbitSpeed: 1,
  })
  controller.resetView({ height: 0 })
  controller.update(1.9)
  assert.equal(controller.state.angle, 0)
  controller.update(.2)
  assert.ok(controller.state.angle > 0)
  const pausedAngle = controller.state.angle
  controller.setIdleOrbitEnabled(true)
  controller.update(1.9)
  assert.equal(controller.state.angle, pausedAngle)
  controller.beginInteraction()
  controller.update(5)
  assert.equal(controller.state.angle, pausedAngle)
  controller.endInteraction()
  controller.update(1.9)
  assert.equal(controller.state.angle, pausedAngle)
  controller.update(.2)
  assert.ok(controller.state.angle > pausedAngle)
  controller.dispose()
})
