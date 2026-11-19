import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createXRControlsGuide } from '../src/systems/ui/createXRControlsGuide.js'

test('controls film plays once per session, stays in the room, and releases each decoder', async t => {
  const videos = []
  const oldDocument = globalThis.document
  t.after(() => { globalThis.document = oldDocument })
  globalThis.document = { createElement() {
    const video = {
      play() { return new Promise((resolve, reject) => { this.reject = reject }) },
      pause() { this.paused = true },
      load() {}, removeAttribute(key) { delete this[key] },
    }
    videos.push(video)
    return video
  } }
  const preview = { src: '/chapter/webxr/media/xr-controls.mp4', width: 1280, height: 832, pause() {} }
  const rig = new THREE.Group(), scene = new THREE.Scene()
  scene.add(rig)
  const guide = createXRControlsGuide(scene, rig, preview)
  const pose = { transform: { position: new THREE.Vector3(0, 1.6, 0), orientation: new THREE.Quaternion() } }
  let tracked = false
  const xr = { getReferenceSpace: () => ({}), getFrame: () => ({ getViewerPose: () => tracked && pose }) }

  guide.start()
  guide.update(xr)
  assert.equal(videos.length, 0)
  tracked = true
  guide.update(xr)
  const screen = scene.getObjectByName('XRControlsGuide')
  const first = videos[0]
  assert.ok(first.muted && first.playsInline)
  assert.equal(first.src, preview.src)
  first.onplaying()
  assert.ok(screen.visible)
  const position = screen.getWorldPosition(new THREE.Vector3())
  rig.position.x = 1
  guide.update(xr)
  assert.ok(position.equals(screen.getWorldPosition(new THREE.Vector3())))
  first.onended()
  guide.update(xr)
  assert.equal(videos.length, 1)
  assert.ok(first.paused && !first.src && !screen.parent)

  guide.start()
  guide.update(xr)
  guide.stop() // leave while play() is pending
  guide.start()
  guide.update(xr)
  videos[1].reject(new Error('Session ended'))
  await Promise.resolve()
  assert.ok(scene.getObjectByName('XRControlsGuide'))
  assert.equal(videos.length, 3)
  videos[2].onerror()
  assert.equal(scene.getObjectByName('XRControlsGuide'), undefined)
  guide.stop()
})
