import * as THREE from 'three'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.45

export function createOrbitalViewSimulation(app) {
  const group = new THREE.Group()
  group.name = 'OrbitalViewSimulation'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.9,
    }),
  )

  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'OrbitalViewPresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'OrbitalViewContentAnchor'
  contentAnchor.position.set(0, CONTENT_HEIGHT, 0)
  simulationRoot.add(contentAnchor)

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xecebe2,
      roughness: 0.35,
      metalness: 0.1,
    }),
  )
  contentAnchor.add(core)

  const orbitGroup = new THREE.Group()
  contentAnchor.add(orbitGroup)

  const orbitA = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.012, 12, 128),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      roughness: 0.3,
      metalness: 0.1,
    }),
  )
  orbitA.rotation.x = Math.PI / 2
  orbitGroup.add(orbitA)

  const orbitB = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.012, 12, 128),
    new THREE.MeshStandardMaterial({
      color: 0xa6a6a0,
      roughness: 0.3,
      metalness: 0.1,
    }),
  )
  orbitB.rotation.x = Math.PI / 2
  orbitB.rotation.y = Math.PI / 3
  orbitGroup.add(orbitB)

  const electron = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      emissive: 0x003344,
      roughness: 0.2,
    }),
  )
  orbitGroup.add(electron)

  let t = 0

  app.scene.add(group)

  return {
    name: 'orbital-view',
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
    },

    handleInput() {},

    update(deltaTime) {
      t += deltaTime

      orbitGroup.rotation.y += deltaTime * 0.25

      electron.position.set(
        Math.cos(t * 1.4) * 0.72,
        Math.sin(t * 1.4) * 0.18,
        Math.sin(t * 1.4) * 0.72,
      )
    },

    dispose() {
      app.scene.remove(group)

      floor.geometry.dispose()
      floor.material.dispose()

      core.geometry.dispose()
      core.material.dispose()

      orbitA.geometry.dispose()
      orbitA.material.dispose()

      orbitB.geometry.dispose()
      orbitB.material.dispose()

      electron.geometry.dispose()
      electron.material.dispose()
    },
  }
}