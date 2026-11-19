import * as THREE from 'three'

// Place the guide once in the room, above the work area and behind the orbital.
const SCREEN_OFFSET = new THREE.Vector3(1.05, 1.15, -3.2)
const UP = new THREE.Vector3(0, 1, 0)

export function createXRControlsGuide(scene, rig, preview) {
  let awaitingPose = false
  let playback = null

  function stop() {
    awaitingPose = false
    if (!playback) return
    const { video, screen } = playback
    playback = null
    video.onended = video.onerror = video.onplaying = null
    video.pause()
    screen.removeFromParent()
    screen.material.map.dispose()
    screen.material.dispose()
    screen.geometry.dispose()
    video.removeAttribute('src')
    video.load()
  }

  function start() {
    stop()
    if (!preview) return
    preview.pause()
    awaitingPose = true
  }

  function update(xr) {
    if (!awaitingPose) return
    const space = xr.getReferenceSpace()
    const pose = space && xr.getFrame()?.getViewerPose(space)
    if (!pose) return
    awaitingPose = false

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.src = preview.currentSrc || preview.src
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2 * preview.height / preview.width),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    )
    screen.name = 'XRControlsGuide'
    const head = new THREE.Vector3().copy(pose.transform.position)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.transform.orientation)
    const yaw = Math.hypot(forward.x, forward.z) > 0.01 ? Math.atan2(-forward.x, -forward.z) : 0
    screen.position.copy(SCREEN_OFFSET).applyAxisAngle(UP, yaw).add(head)
    rig.localToWorld(screen.position)
    screen.lookAt(rig.localToWorld(head))
    screen.visible = false
    scene.add(screen)
    playback = { video, screen }
    // A late rejection from a previous session must not clear the new guide.
    const finish = () => { if (playback?.video === video) stop() }
    video.onplaying = () => { screen.visible = true }
    video.onended = video.onerror = finish
    video.play().catch(finish)
  }

  return { start, update, stop }
}
