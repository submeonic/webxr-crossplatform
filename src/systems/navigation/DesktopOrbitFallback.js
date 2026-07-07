import * as THREE from 'three'

const TEMP_TARGET_POSITION = new THREE.Vector3()

export class DesktopOrbitFallback {
  constructor(camera, options = {}) {
    this.camera = camera

    this.target = options.target ?? new THREE.Vector3(0, 0, -2)
    this.targetOffset = options.targetOffset ?? new THREE.Vector3(0, 1.45, 0)

    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
    }

    this.settings = {
      orbitSpeed: options.orbitSpeed ?? 1.5,
      dollySpeed: options.dollySpeed ?? 2.0,
      minDistance: options.minDistance ?? 0.75,
      maxDistance: options.maxDistance ?? 12.0,
      defaultDistance: options.defaultDistance ?? 2,
    }

    this.state = {
      initialized: false,
      angle: 0,
      distance: this.settings.defaultDistance,
      height: 1.6,
    }

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  setTarget(target, targetOffset = null) {
    this.target = target

    if (targetOffset) {
      this.targetOffset.copy(targetOffset)
    }

    this.reset()
  }

  reset() {
    this.state.initialized = false

    this.keys.forward = false
    this.keys.back = false
    this.keys.left = false
    this.keys.right = false
  }

  setKey(code, pressed) {
    if (code === 'KeyW' || code === 'ArrowUp') {
      this.keys.forward = pressed
      return true
    }

    if (code === 'KeyS' || code === 'ArrowDown') {
      this.keys.back = pressed
      return true
    }

    if (code === 'KeyA' || code === 'ArrowLeft') {
      this.keys.left = pressed
      return true
    }

    if (code === 'KeyD' || code === 'ArrowRight') {
      this.keys.right = pressed
      return true
    }

    return false
  }

  handleKeyDown(event) {
    if (this.setKey(event.code, true)) {
      event.preventDefault()
    }
  }

  handleKeyUp(event) {
    if (this.setKey(event.code, false)) {
      event.preventDefault()
    }
  }

  getTargetPosition() {
    if (this.target instanceof THREE.Object3D) {
      this.target.getWorldPosition(TEMP_TARGET_POSITION)
    } else {
      TEMP_TARGET_POSITION.copy(this.target)
    }

    TEMP_TARGET_POSITION.add(this.targetOffset)

    return TEMP_TARGET_POSITION
  }

  initialize() {
    const targetPosition = this.getTargetPosition()

    const offset = this.camera.position.clone().sub(targetPosition)
    offset.y = 0

    const derivedDistance = offset.length()

    const startingDistance =
      this.settings.defaultDistance ?? derivedDistance

    this.state.distance = THREE.MathUtils.clamp(
      startingDistance,
      this.settings.minDistance,
      this.settings.maxDistance,
    )

    if (derivedDistance < 0.001) {
      this.state.angle = 0
    } else {
      this.state.angle = Math.atan2(offset.x, offset.z)
    }

    this.state.height = this.camera.position.y
    this.state.initialized = true
  }

  update(deltaTime) {
    if (!this.state.initialized) {
      this.initialize()
    }

    const targetPosition = this.getTargetPosition()

    const orbitInput = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)
    const dollyInput = (this.keys.back ? 1 : 0) - (this.keys.forward ? 1 : 0)

    this.state.angle += orbitInput * this.settings.orbitSpeed * deltaTime
    this.state.distance += dollyInput * this.settings.dollySpeed * deltaTime

    this.state.distance = THREE.MathUtils.clamp(
      this.state.distance,
      this.settings.minDistance,
      this.settings.maxDistance,
    )

    this.camera.position.set(
      targetPosition.x + Math.sin(this.state.angle) * this.state.distance,
      this.state.height,
      targetPosition.z + Math.cos(this.state.angle) * this.state.distance,
    )

    this.camera.lookAt(targetPosition)
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
  }
}