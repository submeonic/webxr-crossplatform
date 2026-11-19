import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createTrackedHandModels } from '../src/systems/interaction/createTrackedHandModels.js'

test('slow hand loads and Quest-style input slot changes render at most one tracked skin per side', async () => {
  const slots = [new Group(), new Group()]
  const pending = []
  const loader = { load: (name, complete) => pending.push({ name, complete }) }
  const models = createTrackedHandModels(slots, '/', loader)
  const left = { hand: {}, handedness: 'left' }, replacement = { ...left }
  const event = (slot, type, data) => slot.dispatchEvent({ type, data })
  const data = await readFile(new URL('../public/webxr/models/hands/left.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
  const bones = asset.scene.getObjectByProperty('isSkinnedMesh', true).skeleton.bones
  for (const slot of slots) {
    slot.joints = Object.fromEntries(bones.map(bone => [bone.name, new Group()]))
    slot.joints['middle-finger-phalanx-proximal'].position.x = .08
  }

  event(slots[0], 'connected', left)
  models.update(true)
  event(slots[0], 'disconnected', left)
  event(slots[0], 'connected', { handedness: 'left', gamepad: {} })
  event(slots[1], 'connected', replacement)
  models.update(true)
  assert.deepEqual(pending.map(load => load.name), ['left.glb'])
  pending[0].complete(asset)
  models.update(true)
  const visibleSkins = () => {
    let count = 0
    slots.forEach(slot => slot.traverseVisible(object => { if (object.isSkinnedMesh) count++ }))
    return count
  }
  assert.equal(visibleSkins(), 1)
  assert.ok(slots[1].getObjectByName('TrackedHand_left'))
  event(slots[0], 'connected', left)
  models.update(true)
  assert.equal(visibleSkins(), 1)
  event(slots[0], 'disconnected', left)

  slots[1].joints.wrist.visible = false
  models.update(true)
  assert.equal(visibleSkins(), 0, 'visible fingertips alone cannot resurrect an untracked wrist')
  slots[1].joints.wrist.visible = true
  slots[1].joints['middle-finger-phalanx-proximal'].position.x = 0
  models.update(true)
  assert.equal(visibleSkins(), 0, 'identity poses cannot leave a skin at the floor origin')
  slots[1].joints['middle-finger-phalanx-proximal'].position.x = .08
  models.update(true)
  assert.equal(visibleSkins(), 1, 'a valid tracked hand near floor height is allowed')
  event(slots[1], 'disconnected', replacement)
  models.update(true)
  assert.equal(visibleSkins(), 0)
  models.dispose()
})
