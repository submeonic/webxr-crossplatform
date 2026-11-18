import { createTextLabel } from '../src/systems/ui/createTextLabel.js'
import { PinchDragIndicator } from '../src/systems/interaction/PinchDragIndicator.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createPOrbitalSimulation } from '../src/simulations/p-orbitals/createPOrbitalSimulation.js'
import { create1SOrbitalSimulation } from '../src/simulations/s-orbitals/create1SOrbitalSimulation.js'
import { create2SOrbitalSimulation } from '../src/simulations/s-orbitals/create2SOrbitalSimulation.js'
import { createDOrbitalSimulation } from '../src/simulations/d-orbitals/createDOrbitalSimulation.js'
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
    getAttribute: k => attributes.get(k), querySelector: () => null,
    addEventListener() {}, removeEventListener() {}, remove() {},
    append(...children) { this.children.push(...children) },
    insertBefore(child, reference) {
      const index = this.children.indexOf(reference)
      if (index < 0) this.children.push(child)
      else this.children.splice(index, 0, child)
    } }
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

test('all families share controls and lifecycle while measurement modes stay distinct', () => {
  const { app } = fixture()
  for (const create of [create1SOrbitalSimulation, create2SOrbitalSimulation, createPOrbitalSimulation,createDOrbitalSimulation]) {
    const simulation = create(app)
    simulation.enter()
    assert.ok(simulation.getWebInteractionProfile().horizontalDrag)
    assert.ok(simulation.getWebInteractionProfile().verticalDrag)
    assert.equal(simulation.getViewMode(), 'measurements')
    assert.equal(simulation.pointCloudRoot.visible, true)
    const coverage=simulation.measurementMode==='coverage'
    assert.equal(simulation.probabilityRegionRoot.visible, coverage)
    assert.equal(simulation.idleCameraOrbit, true)
    simulation.setShellOuterRadiusA0(-20)
    assert.equal(simulation.getShellState().outerRadiusA0, 0.25)
    simulation.setShellOuterRadiusA0(50)
    assert.equal(simulation.getShellState().outerRadiusA0, simulation.settings.shellMaxRadiusA0)
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
    simulation.setViewMode('region')
    assert.ok(simulation.getWebInteractionProfile().verticalDrag)
    assert.equal(simulation.pointCloudRoot.visible, true)
    assert.equal(simulation.probabilityRegionRoot.visible, true)
    assert.equal(
      simulation.orbitalRoot.children.find(
        child => child.name.endsWith('ConstantThicknessFresnelShell'),
      ).visible,
      !coverage,
    )
    assert.equal(simulation.webResampleButton.hidden, false)
    assert.equal(simulation.webViewModeButton.getAttribute('role'), 'switch')
    assert.equal(simulation.webViewModeButton.hidden,coverage)
    assert.equal(simulation.webViewModeButton.getAttribute('aria-checked'), String(!coverage))
    simulation.setViewMode('measurements')
    assert.ok(simulation.getWebInteractionProfile().verticalDrag)
    assert.equal(simulation.webViewModeButton.getAttribute('aria-checked'), 'false')
    simulation.exit()
    assert.equal(simulation.group.visible, false)
    simulation.dispose()
    assert.equal(app.scene.children.length, 0)
  }
})
test('XR idle rotation ignores locomotion and menu but resets for pinch drag', () => {
  const { app } = fixture()
  const simulation = create1SOrbitalSimulation(app)
  simulation.enter()
  const idle = { isXR: true, locomotionState: { usingHands: false },
    palmNavigationState: { visible: false } }
  const locomotion = { isXR: true, locomotionState: { usingHands: true },
    palmNavigationState: { visible: false } }
  const menu = { isXR: true, locomotionState: { usingHands: false },
    palmNavigationState: { visible: true } }
  const initialYaw = simulation.orbitalRoot.rotation.y
  simulation.update(2.9, idle)
  assert.equal(simulation.orbitalRoot.rotation.y, initialYaw)
  simulation.update(.2, idle)
  assert.ok(simulation.orbitalRoot.rotation.y > initialYaw)
  const rotatingYaw = simulation.orbitalRoot.rotation.y
  simulation.update(1, locomotion)
  assert.ok(simulation.orbitalRoot.rotation.y > rotatingYaw)
  const afterLocomotion = simulation.orbitalRoot.rotation.y
  simulation.update(1, menu)
  assert.ok(simulation.orbitalRoot.rotation.y > afterLocomotion)
  simulation.handleInput({ right: { visible: true, pinchStarted: true,
    pinchActive: true, pinchPosition: new THREE.Vector3() } }, { isXR: true, deltaTime: 1 / 90 })
  const pausedYaw = simulation.orbitalRoot.rotation.y
  simulation.update(5, idle)
  assert.equal(simulation.orbitalRoot.rotation.y, pausedYaw)
  simulation.handleInput({ right: { visible: true, pinchEnded: true,
    pinchActive: false, pinchPosition: new THREE.Vector3() } }, { isXR: true, deltaTime: 1 / 90 })
  simulation.update(2.9, idle)
  assert.equal(simulation.orbitalRoot.rotation.y, pausedYaw)
  simulation.update(.2, idle)
  assert.ok(simulation.orbitalRoot.rotation.y > pausedYaw)
  simulation.dispose()
})
test('2p selection preserves coverage, sample identity, and inspection yaw while replaying outcomes', () => {
  const { app, viewer } = fixture()
  const p = createPOrbitalSimulation(app)
  const samples = p.getSamples()
  p.setEnclosedProbability(0.65)
  p.orbitalRoot.rotation.y = 1.1
  for (const id of ['2py','2pz','2px']) {
    assert.equal(p.selectOrbital(id), true)
    assert.equal(p.getMeasurementState().probability,0.65)
    assert.equal(p.getMeasurementState().revealedCount,0)
    assert.equal(p.getSamples(), samples)
    assert.equal(p.orbitalRoot.rotation.y, 1.1)
    assert.equal(p.getSelectedOrbital(), id)
    assert.equal(p.getMeasurementState().orbitalType, id)
    assert.equal(p.getMenuActions().filter(a => a.active).length, 1)
  }
  assert.equal(p.selectOrbital('bad-id'), false)
  const orientationGroup = p.webControlsElement.children[0]
  assert.equal(orientationGroup.getAttribute('role'), 'radiogroup')
  assert.deepEqual(
    orientationGroup.children.map(button => button.getAttribute('role')),
    ['radio', 'radio', 'radio'],
  )
  assert.deepEqual(
    orientationGroup.children.map(button => button.getAttribute('aria-checked')),
    ['true', 'false', 'false'],
  )
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
    const rotated = position.clone().applyQuaternion(p.distributionRoot.quaternion)
    assert.ok(Math.abs(rotated.length() - position.length()) < 1e-8)
  }
  p.dispose()
})

test('resampling replaces outcomes but preserves inspection, selection, and shell state', () => {
  const { app } = fixture()
  const p = createPOrbitalSimulation(app)
  p.selectOrbital('2pz')
  p.orbitalRoot.rotation.y = 0.73
  p.setShellOuterRadiusA0(4.25)
  p.setViewMode('region')
  const previousSamples = p.getSamples()
  const previousFirstPosition = previousSamples.positions[0].clone()
  const shell = p.getShellState()

  assert.equal(p.resampleMeasurements(0x12345678), 0x12345678)
  assert.notEqual(p.getSamples(), previousSamples)
  assert.ok(!p.getSamples().positions[0].equals(previousFirstPosition))
  assert.equal(p.getShellState().outerRadiusA0, shell.outerRadiusA0)
  assert.equal(p.getShellState().innerRadiusA0, shell.innerRadiusA0)
  assert.ok(p.getShellState().highlightedCount >= 0)
  assert.equal(p.getSelectedOrbital(), '2pz')
  assert.equal(p.orbitalRoot.rotation.y, 0.73)
  assert.equal(p.getMeasurementSeed(), 0x12345678)
  assert.equal(p.pointCloudRoot.visible, true)
  assert.equal(p.probabilityRegionRoot.visible, true)
  assert.equal(p.webResampleButton.hidden, false)
  p.dispose()
})

test('reveals count only displayed outcomes, restart on selection, and preserve model on resample',()=>{
  const {app}=fixture()
  const d=createDOrbitalSimulation(app)
  d.enter();d.setEnclosedProbability(.7)
  assert.equal(d.getMeasurementState().revealedCount,0)
  assert.equal(d.getMeasurementState().highlightedCount,0)
  for(let i=0;i<90;i++)d.update(1/60,{isXR:false})
  const halfway=d.getMeasurementState()
  assert.ok(halfway.revealedCount>0&&halfway.revealedCount<200)
  assert.ok(halfway.highlightedCount<=halfway.revealedCount)
  for(let i=0;i<91;i++)d.update(1/60,{isXR:false})
  assert.equal(d.getMeasurementState().revealedCount,1000)
  assert.ok(Math.abs(d.getMeasurementState().highlightedCount/1000-.7)<.06)
  d.orbitalRoot.rotation.y=.73
  const radii=d.getSamples().radiiA0
  d.selectOrbital('3dz2')
  assert.deepEqual(d.getSamples().radiiA0,radii)
  assert.equal(d.getMeasurementState().revealedCount,0)
  assert.equal(d.getMeasurementState().coverageType,'3dz2')
  const region=d.probabilityRegionRoot,definition=d.getProbabilityRegionDefinition()
  d.resampleMeasurements(777)
  assert.equal(d.getSelectedOrbital(),'3dz2')
  assert.equal(d.probabilityRegionRoot,region)
  assert.equal(d.getProbabilityRegionDefinition().isovalue,definition.isovalue)
  assert.equal(d.getMeasurementState().probability,.7)
  assert.equal(d.orbitalRoot.rotation.y,.73)
  d.setEnclosedProbability(0)
  assert.equal(d.probabilityRegionRoot.visible,false)
  d.setEnclosedProbability(.05)
  assert.equal(d.probabilityRegionRoot.visible,true)
  d.dispose();assert.equal(app.scene.children.length,0)
})

test('XR family tabs keep footer fixed, activate first choices, and defer page replacement until withdrawal',()=>{
  const {app}=fixture()
  const simulations=[create1SOrbitalSimulation(app),create2SOrbitalSimulation(app),createPOrbitalSimulation(app),createDOrbitalSimulation(app)]
  for(const sim of simulations)sim.metadata={id:sim.id,showInXRMenu:true,xrMenuLabel:sim.label,xrMenuOrder:sim.xrMenuOrder}
  let active=simulations[0],system
  system=new PalmNavigationSystem({...app,gestureSystem:{},onNavigate:({simulation})=>{active=simulation;system.setActiveSimulation(simulation)}})
  system.setSimulations(Object.fromEntries(simulations.map(s=>[s.id,s])))
  system.setActiveSimulation(active);system.menu.setVisible(true)
  assert.ok(system.menu.buttons.some(b=>b.item.id==='orbital-view-mode'))
  const footer=()=>system.menu.buttons.filter(b=>b.item.group==='footer').map(b=>({id:b.item.id,...b.layout}))
  const initialFooter=footer()
  const tab=system.menu.buttons.find(b=>b.item.id==='family-d')
  const at=z=>new THREE.Vector3(tab.layout.x,tab.layout.y,z)
  system.menu.updatePointer(at(.03))
  assert.equal(system.menu.updatePointer(at(.004)).id,'family-d')
  system.selectFamily('d')
  assert.equal(active,simulations[3])
  assert.equal(system.menu.interaction.lockedButton,tab)
  assert.ok(system.menu.pendingItems)
  system.menu.updatePointer(at(.03))
  assert.equal(system.menu.interaction.lockedButton,null)
  assert.deepEqual(footer(),initialFooter)
  assert.equal(system.menu.buttons.filter(b=>b.item.group==='choices').length,5)
  assert.equal(system.menu.buttons.some(b=>b.item.id==='orbital-view-mode'),false)
  for(const b of system.menu.buttons) {
    assert.ok(Math.abs(b.layout.x)+b.layout.width/2<system.menu.settings.width/2)
    assert.ok(Math.abs(b.layout.y)+b.layout.height/2<system.menu.settings.height/2)
  }
  simulations[3].selectOrbital('3dz2')
  system.selectFamily('p');system.selectFamily('d')
  assert.equal(active.getSelectedOrbital(),'3dxy')
  system.selectFamily('s')
  assert.equal(active,simulations[0])
  assert.ok(system.menu.buttons.some(b=>b.item.id==='orbital-view-mode'))
  assert.deepEqual(footer(),initialFooter)
  const pressTab=id=>{
    const b=system.menu.buttons.find(b=>b.item.id===id)
    system.menu.updatePointer(new THREE.Vector3(b.layout.x,b.layout.y,.03))
    system.menu.updatePointer(new THREE.Vector3(b.layout.x,b.layout.y,.004))
  }
  pressTab('family-d');system.selectFamily('d')
  system.menu.updatePointer(null)
  assert.equal(system.menu.pendingItems,null)
  assert.equal(system.menu.buttons.filter(b=>b.item.group==='choices').length,5)
  pressTab('family-p');system.selectFamily('p')
  system.menu.setVisible(false)
  assert.equal(system.menu.pendingItems,null)
  assert.equal(system.menu.buttons.filter(b=>b.item.group==='choices').length,3)
  system.menu.dispose();simulations.forEach(sim=>sim.dispose())
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

test('XR separates orientation and view actions into full-size poke rows', () => {
  const { app } = fixture()
  const menu = new PalmNavigationMenu(app.scene)
  menu.setItems(['1s','2s','2p'].map(id => ({id, label:id, kind:'simulation'})))
  const actions = [
    ...['2px','2py','2pz'].map(id => ({id, label:id, kind:'action', group:'orientation'})),
    {id:'view', label:'REGION', kind:'action', group:'view'},
    {id:'resample', label:'RESAMPLE', kind:'action', group:'view'},
  ]
  menu.setContextActions(actions)
  menu.setVisible(true)

  for (const button of menu.buttons) {
    assert.ok(Math.abs(button.layout.x) + button.layout.width / 2 < menu.settings.width / 2)
    assert.ok(Math.abs(button.layout.y) + button.layout.height / 2 < menu.settings.height / 2)
  }
  const orientationButtons = menu.buttons.filter(button => button.item.group === 'orientation')
  const viewButtons = menu.buttons.filter(button => button.item.group === 'view')
  assert.equal(new Set(orientationButtons.map(button => button.layout.y)).size, 1)
  assert.equal(new Set(viewButtons.map(button => button.layout.y)).size, 1)
  assert.notEqual(orientationButtons[0].layout.y, viewButtons[0].layout.y)
  assert.ok([...orientationButtons, ...viewButtons].every(
    button =>
      button.layout.width === menu.settings.navigationButtonWidth &&
      button.layout.height === menu.settings.navigationButtonHeight,
  ))
  const rowGap = Math.abs(
    orientationButtons[0].layout.y - viewButtons[0].layout.y,
  ) - menu.settings.navigationButtonHeight
  assert.ok(rowGap > 0)

  const viewButton = menu.buttons.find(button => button.item.id === 'view')
  const at = z => new THREE.Vector3(viewButton.layout.x, viewButton.layout.y, z)
  menu.updatePointer(at(0.03))
  assert.equal(menu.updatePointer(at(0.004)).id, 'view')
  menu.setContextActions(actions.map(action =>
    action.id === 'view' ? {...action, active:true} : action))
  assert.equal(menu.interaction.lockedButton, viewButton)
  assert.ok(menu.buttons.some(button => button.item.id === 'resample'))
  menu.updatePointer(at(0.03))
  assert.equal(menu.interaction.lockedButton, null)
  assert.ok(menu.buttons.some(button => button.item.id === 'resample'))
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
test('fixed panel follows rig and physical steps, holds heading through head turns, and resets on exit', () => {
  const { app } = fixture()
  const rig = new THREE.Group()
  app.scene.add(rig)
  const transform = { position: new THREE.Vector3(0, 1.6, 0), orientation: new THREE.Quaternion() }
  const session = { inputSources: [] }
  const frame = { getViewerPose: () => ({ transform }) }
  Object.assign(app.renderer.xr, {
    isPresenting: true, getFrame: () => frame, getSession: () => session, getReferenceSpace: () => ({}),
  })
  const system = new PalmNavigationSystem({ ...app, trackingRoot: rig })
  const panel = system.menu.group
  system.update(1 / 90)
  assert.ok(panel.visible && panel.position.x < 0 && panel.position.y < 1.6 && panel.position.z < 0)
  const position = panel.position.clone()
  const facing = panel.quaternion.clone()
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(facing)
  assert.ok(normal.dot(transform.position.clone().sub(position).normalize()) > .999)
  transform.orientation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
  system.update(1)
  assert.ok(panel.position.equals(position) && panel.quaternion.equals(facing))
  rig.position.set(2, 0, 3)
  rig.rotation.y = .6
  system.update(1, { allowPoke: false })
  assert.ok(panel.getWorldPosition(new THREE.Vector3()).distanceTo(rig.localToWorld(position.clone())) < 1e-8)
  transform.position.x += .02
  system.update(1)
  assert.ok(panel.quaternion.equals(facing))
  transform.position.x += .25
  system.update(2)
  assert.ok(panel.position.x > transform.position.x, 'walking right updates body heading')
  transform.orientation.identity()
  system.update(2, { forward: true, allowPoke: false })
  assert.ok(panel.position.z < 0 && panel.quaternion.angleTo(facing) < .001)
  app.renderer.xr.isPresenting = false
  system.update(1)
  assert.equal(panel.visible, false)
  system.dispose()
})

test('either index can dim and restore the panel, and interrupted pokes require a new approach', () => {
  const { app } = fixture()
  const session = { inputSources: [] }
  const tip = new THREE.Vector3()
  const frame = {
    getViewerPose: () => ({ transform: { position: new THREE.Vector3(0, 1.4, 0), orientation: new THREE.Quaternion() } }),
    getJointPose: () => ({ transform: { position: tip } }),
  }
  Object.assign(app.renderer.xr, {
    isPresenting: true, getFrame: () => frame, getReferenceSpace: () => ({}), getSession: () => session,
  })
  const system = new PalmNavigationSystem(app)
  system.setSimulations({})
  const menu = system.menu
  const aim = (id, z) => {
    const { x, y } = menu.buttons.find(button => button.item.id === id).layout
    menu.group.localToWorld(tip.set(x, y, z))
  }
  const tick = (allowPoke = true) => system.update(1 / 90, { allowPoke }).activatedItem?.id
  tick()
  for (const side of ['right', 'left']) {
    session.inputSources = [{ handedness: side, hand: new Map([['index-finger-tip', {}]]) }]
    aim('visibility', .035)
    tick()
    aim('visibility', .002)
    assert.equal(tick(), 'visibility')
    assert.equal(tick(), undefined)
    const dim = side === 'right'
    assert.equal(menu.dimmed, dim)
    assert.equal(menu.panelMaterial.opacity, dim ? .15 : 1)
    assert.ok(menu.buttons.every(button => button.material.opacity === menu.panelMaterial.opacity))
    if (dim) {
      aim('exit-xr', .035)
      tick()
      aim('exit-xr', .002)
      assert.equal(tick(), undefined)
    }
  }
  aim('exit-xr', .035)
  tick()
  tick(false)
  aim('exit-xr', .002)
  assert.equal(tick(), undefined)
  aim('exit-xr', .035)
  tick()
  session.inputSources = []
  tick()
  assert.equal(menu.group.visible, true)
  system.dispose()
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
