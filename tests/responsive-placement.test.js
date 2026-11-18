import test from 'node:test'
import assert from 'node:assert/strict'
import { ResponsiveViewerPlacementController } from '../src/systems/navigation/ResponsiveViewerPlacementController.js'

function element(dataset = {}) {
  return {
    dataset, children: [], parentElement: null,
    appendChild(child) {
      if (child.parentElement) child.parentElement.children.splice(child.parentElement.children.indexOf(child), 1)
      child.parentElement = this
      this.children.push(child)
    },
    contains(child) { return child === this || this.children.some(item => item.contains(child)) },
  }
}

function fixture() {
  const desktop = element(), viewer = element(), controls = element(), button = element()
  desktop.appendChild(viewer); viewer.appendChild(controls); controls.appendChild(button)
  const scenes = ['1s', '2p', '3d'].map(id => element({ viewerSlot: `${id}-orbital` }))
  const menus = ['1s', '2p', '3d'].map(id => element({ controlsSlot: `${id}-orbital` }))
  const media = { matches: true }
  let xr = false, updates = 0, focusRestored = 0
  globalThis.window = { matchMedia: query => query === '(max-width: 760px)' ? media : { matches: false } }
  globalThis.document = {
    activeElement: button,
    querySelectorAll: selector => selector === '[data-controls-slot]' ? menus : scenes,
  }
  globalThis.requestAnimationFrame = callback => callback()
  button.focus = options => { assert.equal(options.preventScroll, true); focusRestored++ }
  const controller = new ResponsiveViewerPlacementController({
    viewerElement: viewer, desktopSlot: desktop, controlsElement: controls,
    isXRPresenting: () => xr, onPlacementChanged: () => updates++,
  })
  return { controller, desktop, viewer, controls, scenes, menus, media,
    setXR(value) { xr = value }, get updates() { return updates }, get focusRestored() { return focusRestored } }
}

test('viewer and existing controls follow the mobile lesson together and restore beneath desktop viewer', () => {
  const f = fixture()
  f.controller.setActiveSimulation('2p-orbital')
  assert.equal(f.viewer.parentElement, f.scenes[1])
  assert.equal(f.controls.parentElement, f.menus[1])
  assert.equal(f.focusRestored, 1)
  assert.equal(f.controller.refreshPlacement(), false)
  assert.equal(f.updates, 1)
  f.controller.setActiveSimulation('3d-orbital')
  assert.equal(f.viewer.parentElement, f.scenes[2])
  assert.equal(f.controls.parentElement, f.menus[2])
  assert.equal(f.menus[1].children.length, 0)
  f.media.matches = false
  f.controller.refreshPlacement()
  assert.equal(f.viewer.parentElement, f.desktop)
  assert.equal(f.controls.parentElement, f.viewer)
  assert.equal(f.focusRestored, 3)
})

test('XR defers moving both bundles until presentation ends', () => {
  const f = fixture()
  f.controller.setActiveSimulation('1s-orbital')
  f.setXR(true)
  f.controller.setActiveSimulation('3d-orbital')
  assert.equal(f.controller.placementPending, true)
  assert.equal(f.viewer.parentElement, f.scenes[0])
  assert.equal(f.controls.parentElement, f.menus[0])
  f.setXR(false)
  f.controller.refreshPlacement()
  assert.equal(f.controller.placementPending, false)
  assert.equal(f.viewer.parentElement, f.scenes[2])
  assert.equal(f.controls.parentElement, f.menus[2])
})
