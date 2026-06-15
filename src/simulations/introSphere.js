import * as THREE from 'three'

export function createIntroSphereSimulation(app) {
  const group = new THREE.Group()
  group.name = 'IntroSphereSimulation'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x202020,
      roughness: 0.9,
      metalness: 0.0
    })
  )

  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  group.add(floor)

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 48, 48),
    new THREE.MeshStandardMaterial({
      color: 0x00b5d8,
      roughness: 0.35,
      metalness: 0.05
    })
  )

  sphere.position.set(0, 1.5, -2)
  group.add(sphere)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.012, 12, 96),
    new THREE.MeshStandardMaterial({
      color: 0xecebe2,
      roughness: 0.5,
      metalness: 0.1
    })
  )

  ring.position.copy(sphere.position)
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  app.scene.add(group)

  return {
    name: 'intro',
    group,
    orbitTarget: sphere,

    enter() {
      group.visible = true
    },

    exit() {
      group.visible = false
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
    }
  }
}