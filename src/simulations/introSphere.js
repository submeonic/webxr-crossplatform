import * as THREE from 'three'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.5

export function createIntroSphereSimulation(app) {
  const group = new THREE.Group()
  group.name = 'IntroSphereSimulation'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x202020,
      roughness: 0.9,
      metalness: 0.0,
    }),
  )

  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'IntroSpherePresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'IntroSphereContentAnchor'
  contentAnchor.position.set(0, CONTENT_HEIGHT, 0)
  simulationRoot.add(contentAnchor)

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      roughness: 0.35,
      metalness: 0.05,
    }),
  )

  contentAnchor.add(sphere)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.012, 12, 96),
    new THREE.MeshStandardMaterial({
      color: 0xecebe2,
      roughness: 0.5,
      metalness: 0.1,
    }),
  )

  ring.rotation.x = Math.PI / 2
  contentAnchor.add(ring)

  const scaleInteraction = {
    active: false,
    handedness: null,
    startY: 0,
    startScale: 1,
  }

  function getPinchStartedHand(interactionState) {
    const right = interactionState.right
    const left = interactionState.left

    if (right?.pinchStarted) {
      return {
        handedness: 'right',
        hand: right,
      }
    }

    if (left?.pinchStarted) {
      return {
        handedness: 'left',
        hand: left,
      }
    }

    return null
  }

  function endScaleInteraction() {
    scaleInteraction.active = false
    scaleInteraction.handedness = null
  }

  app.scene.add(group)

  return {
    name: 'intro',
    group,
    simulationRoot,
    contentAnchor,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(0, CONTENT_HEIGHT, 0),

    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
    },

    exit() {
      group.visible = false
      endScaleInteraction()
    },

    handleInput(interactionState) {
      /*
        If no hand is currently controlling scale, either hand may start it.
      */
      if (!scaleInteraction.active) {
        const started = getPinchStartedHand(interactionState)

        if (started) {
          scaleInteraction.active = true
          scaleInteraction.handedness = started.handedness
          scaleInteraction.startY = started.hand.pinchPosition.y
          scaleInteraction.startScale = sphere.scale.x
        }
      }

      if (!scaleInteraction.active) return

      const activeHand =
        interactionState[scaleInteraction.handedness]

      /*
        If the controlling hand disappears or releases pinch, stop scaling.
      */
      if (
        !activeHand ||
        activeHand.pinchEnded ||
        !activeHand.pinchActive
      ) {
        endScaleInteraction()
        return
      }

      const dragY =
        activeHand.pinchPosition.y - scaleInteraction.startY

      /*
        Vertical drag scaling:
          drag up = bigger
          drag down = smaller
      */
      const nextScale = THREE.MathUtils.clamp(
        scaleInteraction.startScale + dragY * 1.5,
        0.35,
        2.5,
      )

      sphere.scale.setScalar(nextScale)
      ring.scale.setScalar(nextScale)
    },

    update(deltaTime) {
      sphere.rotation.y += deltaTime * 0.45
      ring.rotation.z += deltaTime * 0.35
    },

    dispose() {
      app.scene.remove(group)

      floor.geometry.dispose()
      floor.material.dispose()

      sphere.geometry.dispose()
      sphere.material.dispose()

      ring.geometry.dispose()
      ring.material.dispose()
    },
  }
}