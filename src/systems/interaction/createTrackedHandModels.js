import { Group } from 'three'
import { XRHandMeshModel } from 'three/addons/webxr/XRHandMeshModel.js'

function releaseMesh(root) {
  root.traverse(object => {
    if (!object.isSkinnedMesh) return
    object.skeleton.dispose()
    object.geometry.dispose()
    object.material.dispose()
  })
}

// Input slots can change hands or become controllers. Own one skin per anatomical
// side, so a delayed GLB load can never append a second skin to a reused slot.
export function createTrackedHandModels(hands, path, loader = null) {
  const sources = new Map()
  const models = new Map()
  let disposed = false

  function disconnect({ target, data }) {
    if (!data || sources.get(target) !== data) return
    sources.delete(target)
    const model = models.get(data.handedness)
    if (model?.group.parent === target) model.group.removeFromParent()
  }

  function connect({ target, data }) {
    if (data.hand && (data.handedness === 'left' || data.handedness === 'right')) {
      sources.set(target, data)
    } else {
      sources.delete(target)
    }
  }

  for (const hand of hands) {
    hand.addEventListener('connected', connect)
    hand.addEventListener('disconnected', disconnect)
  }

  function update(isXR) {
    for (const { group } of models.values()) group.visible = false
    if (!isXR) return
    for (const [hand, source] of sources) {
      const wrist = hand.joints.wrist
      const knuckle = hand.joints['middle-finger-phalanx-proximal']
      if (!hand.visible || !wrist?.visible || !knuckle?.visible) continue
      // All-identity joint poses collapse onto the reference-space origin.
      if (!(wrist.position.distanceToSquared(knuckle.position) > 1e-6)) continue

      const side = source.handedness
      let model = models.get(side)
      if (!model) {
        const group = new Group()
        group.name = 'TrackedHand_' + side
        group.visible = false
        const skin = new XRHandMeshModel(group, hand, path, side, loader, object => {
          if (disposed) releaseMesh(object)
        })
        model = { group, skin }
        models.set(side, model)
      }
      const { group, skin } = model
      if (group.visible || !skin.bones.length) continue
      if (!skin.bones.every(bone => !bone || hand.joints[bone.jointName]?.visible)) continue
      if (group.parent !== hand) hand.add(group)
      skin.controller = hand
      skin.updateMesh()
      group.visible = true
    }
  }

  function dispose() {
    disposed = true
    for (const hand of hands) {
      hand.removeEventListener('connected', connect)
      hand.removeEventListener('disconnected', disconnect)
    }
    for (const { group } of models.values()) {
      group.removeFromParent()
      releaseMesh(group)
    }
    sources.clear()
    models.clear()
  }

  return { update, dispose }
}
