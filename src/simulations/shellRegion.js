import * as THREE from 'three'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.45

export function createShellRegionSimulation(app) {
  const group = new THREE.Group()
  group.name = 'ShellRegionSimulation'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
    }),
  )

  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'ShellRegionPresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'ShellRegionContentAnchor'
  contentAnchor.position.set(0, CONTENT_HEIGHT, 0)
  simulationRoot.add(contentAnchor)

  const innerShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 64, 32),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      transparent: true,
      opacity: 0.18,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
  )

  contentAnchor.add(innerShell)

  const outerShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 64, 32),
    new THREE.MeshStandardMaterial({
      color: 0xecebe2,
      transparent: true,
      opacity: 0.12,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
  )

  contentAnchor.add(outerShell)

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.03, 16, 128),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      roughness: 0.3,
      metalness: 0.1,
    }),
  )

  band.rotation.x = Math.PI / 2
  contentAnchor.add(band)

  app.scene.add(group)

  return {
    name: 'shell',
    group,
    simulationRoot,
    contentAnchor,
    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
    },

    exit() {
      group.visible = false
    },

    /*
      Reserved for shell-specific interactions.
      Example future uses:
      - pinch-drag inner radius
      - pinch-drag outer radius
      - grab shell band
      - two-hand scale shell region
    */
    handleInput() {},

    update(deltaTime) {
      innerShell.rotation.y += deltaTime * 0.18
      outerShell.rotation.y -= deltaTime * 0.12
      band.rotation.z += deltaTime * 0.45
    },

    dispose() {
      app.scene.remove(group)

      floor.geometry.dispose()
      floor.material.dispose()

      innerShell.geometry.dispose()
      innerShell.material.dispose()

      outerShell.geometry.dispose()
      outerShell.material.dispose()

      band.geometry.dispose()
      band.material.dispose()
    },
  }
}