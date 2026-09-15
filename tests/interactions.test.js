import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { AxisDragControlSystem } from '../src/systems/interaction/AxisDragControlSystem.js'
import { createOrbitalControls } from '../src/systems/interaction/createOrbitalControls.js'
import { selectOrbitalOrientation } from '../src/simulations/p-orbitals/OrbitalSelection.js'
import { getPalmPanelPose } from '../src/systems/navigation/palmPanelPose.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
function pose(x = 0, y = 0, z = 0, started = false) {
  return { visible: true, pinchActive: true, pinchStarted: started, pinchPosition: new THREE.Vector3(x, y, z) }
}
function fixture() {
  const camera = new THREE.PerspectiveCamera()
  const events = []
  const indicator = { show: value => events.push(['show', value]), update() {}, hide: () => events.push(['hide']) }
  const control = new AxisDragControlSystem({ camera, indicator,
    horizontal: { onChange: value => events.push(['x', value]) },
    vertical: { onChange: value => events.push(['y', value]) } })
  return { control, camera, events }
}

test('pinch reserves input but does not alter values before threshold', () => {
  const { control, events } = fixture()
  control.update({ right: pose(0, 0, 0, true) })
  control.update({ right: pose(0.005, 0.003) })
  assert.equal(control.isActive(), true)
  assert.equal(control.axis, null)
  assert.deepEqual(events, [])
})
test('diagonal ambiguity waits; horizontal lock prevents later vertical action', () => {
  const { control, events } = fixture()
  control.update({ right: pose(0, 0, 0, true) })
  control.update({ right: pose(0.02, 0.02) })
  assert.equal(control.axis, null)
  control.update({ right: pose(0.05, 0.02) })
  control.update({ right: pose(0.05, 0.3) })
  assert.equal(control.axis, 'horizontal')
  assert.equal(events.filter(e => e[0] === 'y').length, 0)
  near(events.at(-1)[1], 0.05)
})
test('horizontal follows viewer yaw and stays fixed after head movement', () => {
  const { control, camera, events } = fixture()
  camera.rotation.y = Math.PI / 2
  camera.updateMatrixWorld()
  control.update({ left: pose(0, 0, 0, true) })
  camera.rotation.y = 0
  camera.updateMatrixWorld()
  control.update({ left: pose(0, 0, -0.1) })
  assert.equal(control.axis, 'horizontal')
  near(events.at(-1)[1], 0.1)
})
test('left hand works; tracking loss ends action without adopting a held pinch', () => {
  const { control } = fixture()
  control.update({ left: pose(0, 0, 0, true) })
  control.update({ left: pose(0, 0.1) })
  assert.equal(control.axis, 'vertical')
  control.update({})
  assert.equal(control.isActive(), false)
  control.update({ left: pose(0, 0.2) })
  assert.equal(control.isActive(), false)
})
test('simultaneous pinches have one deterministic owner; release clears indicator', () => {
  const { control, events } = fixture()
  control.update({ right: pose(0, 0, 0, true), left: pose(0, 0, 0, true) })
  assert.equal(control.hand, 'right')
  control.update({ right: { ...pose(), pinchEnded: true }, left: pose(0, 0.2) })
  assert.equal(control.isActive(), false)
  assert.equal(events.at(-1)[0], 'hide')
})
test('menu cancellation requires a fresh pinch', () => {
  const { control } = fixture()
  control.update({ right: pose(0, 0, 0, true) })
  control.update({ right: pose(0.1) })
  control.reset('palm-navigation-opened')
  control.update({ right: pose(0.3) })
  assert.equal(control.isActive(), false)
})
test('shell clamps independently of yaw and both web and XR use current radius', () => {
  let radius = 3
  const target = new THREE.Group()
  const controls = createOrbitalControls({ app: { camera: new THREE.PerspectiveCamera() },
    target, getRadius: () => radius,
    setRadius: value => (radius = Math.max(0.25, Math.min(12, value))), minRadius: 0.25, maxRadius: 12 })
  controls.xr.update({ right: pose(0, 0, 0, true) })
  controls.xr.update({ right: pose(0, 2) })
  assert.equal(radius, 12)
  assert.equal(target.rotation.y, 0)
  controls.xr.reset()
  controls.web.horizontalDrag.onStart()
  controls.web.horizontalDrag.onChange({ totalDeltaX: 100 })
  near(target.rotation.y, 0.8)
  assert.equal(radius, 12)
  controls.web.verticalDrag.onStart()
  controls.web.verticalDrag.onChange({ totalDeltaY: 1000 })
  assert.equal(radius, 0.25)
  near(target.rotation.y, 0.8)
})
test('repeated horizontal gestures accumulate rotation instead of resetting it', () => {
  const target = new THREE.Group()
  const { xr } = createOrbitalControls({ app: { camera: new THREE.PerspectiveCamera() }, target,
    getRadius: () => 1, setRadius: x => x, minRadius: 0.25, maxRadius: 12 })
  for (let i = 0; i < 3; i++) {
    xr.update({ right: pose(0, 0, 0, true) })
    xr.update({ right: pose(0.1) })
    xr.reset()
  }
  near(target.rotation.y, 2.1)
})
test('orbital selection is local, deterministic and preserves inspection rotation', () => {
  const root = new THREE.Group(), cloud = new THREE.Group()
  root.add(cloud)
  root.rotation.y = 0.7
  for (const [id, expected] of [['2px', [1,0,0]], ['2py', [0,1,0]], ['2pz', [0,0,1]], ['2px', [1,0,0]]]) {
    assert.equal(selectOrbitalOrientation(cloud, id), true)
    const axis = new THREE.Vector3(1,0,0).applyQuaternion(cloud.quaternion)
    assert.ok(axis.distanceTo(new THREE.Vector3(...expected)) < 1e-8)
    near(root.rotation.y, 0.7)
  }
  const before = cloud.quaternion.clone()
  assert.equal(selectOrbitalOrientation(cloud, 'invalid'), false)
  assert.ok(before.equals(cloud.quaternion))
})
test('panel remains finite, upright and tilt-limited even directly above/below viewer', () => {
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion()
  for (const viewer of [[0,1,0], [0,-1,0], [0,0,0], [1,10,0], [-1,0,0], [0,0,-1]]) {
    getPalmPanelPose({ palmCenter: new THREE.Vector3(), viewerPosition: new THREE.Vector3(...viewer) }, position, quaternion)
    assert.ok([...position.toArray(), ...quaternion.toArray()].every(Number.isFinite))
    near(quaternion.length(), 1)
    const normal = new THREE.Vector3(0,0,1).applyQuaternion(quaternion)
    const up = new THREE.Vector3(0,1,0).applyQuaternion(quaternion)
    assert.ok(Math.abs(normal.y) <= Math.sin(20 * Math.PI / 180) + 1e-8)
    assert.ok(up.y > 0.93)
  }
})
