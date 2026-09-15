import { createTextLabel } from '../src/systems/ui/createTextLabel.js'
import { PinchDragIndicator } from '../src/systems/interaction/PinchDragIndicator.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createPOrbitalSimulation } from '../src/simulations/p-orbitals/createPOrbitalSimulation.js'
import { create1SOrbitalSimulation } from '../src/simulations/s-orbitals/create1SOrbitalSimulation.js'
import { create2SOrbitalSimulation } from '../src/simulations/s-orbitals/create2SOrbitalSimulation.js'
import { PalmNavigationMenu } from '../src/systems/navigation/PalmNavigationMenu.js'
import { PalmNavigationSystem } from '../src/systems/navigation/PalmNavigationSystem.js'

// Rendering is browser-checked separately. This fixture exercises real scene geometry,
// selection, lifecycle and poke logic without requiring a graphics device in CI.
function element() {
  const attributes = new Map()
  const context = new Proxy({ measureText: text => ({ width: text.length * 18 }) }, {
    get: (target, key) => key in target ? target[key] : () => {},
  })
  return { hidden: false, children: [], style: {}, classList: { toggle() {} },
    getContext: () => context, setAttribute: (k,v) => attributes.set(k,v),
    getAttribute: k => attributes.get(k),
    addEventListener() {}, removeEventListener() {}, remove() {}, append(...children) { this.children.push(...children) } }
}
function fixture() {
  const viewer = element()
  globalThis.document = {
    createElement: () => element(),
    getElementById: () => null,
    querySelector: () => viewer,
  }
  const app = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    renderer: { xr: { isPresenting: false } },
    palmNavigationSystem: { refreshContextActions() {} },
    getActiveSimulation: () => null,
    pinchDragIndicator: { hide() {}, show() {}, update() {}, setAxis() {} },
  }
  return { app, viewer }
}

test('all simulations share controls, shell limits, and XR-only panel lifecycle', () => {
  const { app } = fixture()
  for (const create of [create1SOrbitalSimulation, create2SOrbitalSimulation, createPOrbitalSimulation]) {
    const simulation = create(app)
    simulation.enter()
    assert.ok(simulation.getWebInteractionProfile().horizontalDrag)
    assert.ok(simulation.getWebInteractionProfile().verticalDrag)
    simulation.setShellOuterRadiusA0(-20)
    assert.equal(simulation.getShellState().outerRadiusA0, 0.25)
    simulation.setShellOuterRadiusA0(50)
    assert.equal(simulation.getShellState().outerRadiusA0, 12)
    simulation.update(1/60, { isXR: true })
    const activity = simulation.group.getObjectByName('GuidedActivityPanel')
    const graph = simulation.group.getObjectByName('RadialProbabilityGraphPanel')
    assert.equal(activity.visible, true)
    assert.equal(graph.visible, true)
    assert.equal(activity.parent, simulation.simulationRoot)
    assert.equal(graph.parent, simulation.simulationRoot)
    simulation.update(1/60, { isXR: false })
    assert.equal(activity.visible, false)
    assert.equal(graph.visible, false)
    simulation.exit()
    assert.equal(simulation.group.visible, false)
    simulation.dispose()
    assert.equal(app.scene.children.length, 0)
  }
})
test('2p selection preserves radius, highlight count, sample identity, and inspection yaw', () => {
  const { app, viewer } = fixture()
  const p = createPOrbitalSimulation(app)
  const samples = p.getSamples()
  p.setShellOuterRadiusA0(4)
  const shell = p.getShellState()
  p.orbitalRoot.rotation.y = 1.1
  for (const id of ['2py','2pz','2px']) {
    assert.equal(p.selectOrbital(id), true)
    assert.deepEqual(p.getShellState(), shell)
    assert.equal(p.getSamples(), samples)
    assert.equal(p.orbitalRoot.rotation.y, 1.1)
    assert.equal(p.getSelectedOrbital(), id)
    assert.equal(p.settings.graphConfig.datasets.at(-1).label, id)
    assert.equal(p.getMenuActions().filter(a => a.active).length, 1)
  }
  assert.equal(p.selectOrbital('bad-id'), false)
  p.enter()
  assert.equal(viewer.children[0].hidden, false)
  p.update(0, {isXR:true})
  assert.equal(viewer.children[0].hidden, true)
  p.exit()
  p.dispose()
})
test('selecting another orbital preserves transformed sample distances', () => {
  const { app } = fixture()
  const p = createPOrbitalSimulation(app)
  p.selectOrbital('2pz')
  for (const position of p.getSamples().positions.slice(0,50)) {
    const rotated = position.clone().applyQuaternion(p.pointCloudRoot.quaternion)
    assert.ok(Math.abs(rotated.length() - position.length()) < 1e-8)
  }
  p.dispose()
})
test('context action rows fit panel and preserve poke lock across selection changes', () => {
  const { app } = fixture()
  const menu = new PalmNavigationMenu(app.scene)
  menu.setItems(['1s','2s','2p'].map(id => ({id, label:id, kind:'simulation'})))
  let selected = '2px'
  const actions = () => ['2px','2py','2pz'].map(id => ({id, label:id, kind:'action', active:id===selected}))
  menu.setContextActions(actions())
  menu.setVisible(true)
  for (const button of menu.buttons) {
    assert.ok(Math.abs(button.layout.x) + button.layout.width/2 < menu.settings.width/2)
    assert.ok(Math.abs(button.layout.y) + button.layout.height/2 < menu.settings.height/2)
  }
  const button = menu.buttons.find(b => b.item.id === '2py')
  const at = z => new THREE.Vector3(button.layout.x, button.layout.y, z)
  assert.equal(menu.updatePointer(at(0.03)), null)
  const activated = menu.updatePointer(at(0.004))
  assert.equal(activated.id, '2py')
  selected = '2py'
  menu.setContextActions(actions())
  assert.equal(menu.interaction.lockedButton, button)
  assert.equal(menu.updatePointer(at(0.003)), null)
  assert.equal(menu.updatePointer(at(0.03)), null)
  assert.equal(menu.interaction.lockedButton, null)
  menu.dispose()
})
test('finger must approach from the front, never trigger by appearing behind a button', () => {
  const { app } = fixture()
  const menu = new PalmNavigationMenu(app.scene)
  menu.setItems([{id:'2p', label:'2p', kind:'simulation'}])
  menu.setVisible(true)
  const button = menu.buttons[0]
  const at = z => new THREE.Vector3(button.layout.x, button.layout.y, z)
  assert.equal(menu.updatePointer(at(-0.001)), null)
  assert.equal(menu.updatePointer(at(0.004)), null)
  menu.updatePointer(at(0.03))
  assert.equal(menu.updatePointer(at(0.004)).id, '2p')
  menu.dispose()
})
test('panel ignores palm roll and freezes while the opposite finger approaches', () => {
  const { app } = fixture()
  app.camera.position.set(0,1.6,1)
  app.camera.updateMatrixWorld()
  const system = new PalmNavigationSystem({ ...app, gestureSystem:{} })
  const owner = { tracked:true, palmCenter:new THREE.Vector3(0,1.1,0) }
  system.updateMenuTransform(owner, 1/60)
  const position = system.menu.group.position.clone()
  const quaternion = system.menu.group.quaternion.clone()
  system.menu.pointer.visible = true
  owner.palmCenter.x += 0.03
  system.updateMenuTransform(owner, 1/60)
  assert.ok(system.menu.group.position.equals(position))
  assert.ok(system.menu.group.quaternion.equals(quaternion))
  system.menu.pointer.visible = false
  system.updateMenuTransform(owner, 1/60)
  assert.ok(system.menu.group.position.x > position.x)
  system.menu.dispose()
})

test('billboard faces the camera with no roll even under a rotated parent', () => {
  fixture()
  const label = createTextLabel('Z'), parent = new THREE.Group()
  parent.rotation.y = .7; parent.add(label.sprite)
  const camera = new THREE.PerspectiveCamera(); camera.position.set(1, 2, 4)
  camera.rotation.z = .8
  parent.updateMatrixWorld(true); camera.updateMatrixWorld(true)
  label.sprite.onBeforeRender(null, null, camera)
  const q = label.sprite.getWorldQuaternion(new THREE.Quaternion())
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  assert.ok(Math.abs(right.y) < 1e-8)
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
  assert.ok(normal.distanceTo(camera.position.clone().normalize()) < 1e-8)
  label.dispose()
})
test('world indicator keeps origin and endpoint aligned after locomotion', () => {
  fixture()
  const rig = new THREE.Scene(); rig.updateMatrixWorld(true)
  const indicator = new PinchDragIndicator(rig, new THREE.PerspectiveCamera())
  indicator.show({ originWorldPosition: new THREE.Vector3(2, 1, 1), rightVector: new THREE.Vector3(1, 0, 0) })
  assert.equal(indicator.group.visible, true)
  assert.ok(indicator.origin.distanceTo(new THREE.Vector3(2, 1, 1)) < 1e-8)
  indicator.update({ currentWorldPosition: new THREE.Vector3(2.12, 1.01, 1.02) })
  assert.ok(indicator.endpoint.distanceTo(new THREE.Vector3(2.12, 1.01, 1.02)) < 1e-8)
  assert.ok(indicator.labels[2].sprite.material.opacity < indicator.labels[3].sprite.material.opacity)
  indicator.hide(); assert.equal(indicator.group.visible, false); indicator.dispose()
})

test('billboards never overwrite renderer-managed XR eye matrices after rig movement', () => {
  fixture()
  const label = createTextLabel('Z'), eye = new THREE.PerspectiveCamera()
  eye.position.set(.03, 1.6, 0)
  eye.updateMatrixWorld(true)
  const rig = new THREE.Matrix4().makeRotationY(.8)
  rig.setPosition(3, 0, -4)
  eye.matrixWorld.multiplyMatrices(rig, eye.matrix)
  eye.matrixWorldInverse.copy(eye.matrixWorld).invert()
  const world = eye.matrixWorld.clone(), inverse = eye.matrixWorldInverse.clone()
  label.sprite.onBeforeRender(null, null, eye)
  assert.deepEqual(eye.matrixWorld.elements, world.elements)
  assert.deepEqual(eye.matrixWorldInverse.elements, inverse.elements)
  label.dispose()
})
test('drag feedback draws in transparent overlay group and shows only the selected guide', () => {
  fixture()
  const ui = new PinchDragIndicator(new THREE.Scene(), new THREE.PerspectiveCamera())
  ui.show({ originWorldPosition: new THREE.Vector3(), rightVector: new THREE.Vector3(1, 0, 0), pending: true })
  assert.equal(ui.guideSegment.visible, false)
  ui.setAxis('horizontal')
  assert.equal(ui.guideSegment.visible, true)
  assert.equal(ui.labels[0].sprite.visible, false)
  assert.equal(ui.labels[2].sprite.visible, true)
  for (const node of ui.group.children) {
    assert.equal(node.material.transparent, true)
    assert.equal(node.material.depthTest, false)
    assert.equal(node.material.depthWrite, false)
  }
  assert.ok(ui.group.renderOrder > 1000)
  ui.dispose()
})
