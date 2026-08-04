import * as THREE from 'three'

const TEMP_TARGET_POSITION = new THREE.Vector3()
const TEMP_CAMERA_WORLD_POSITION = new THREE.Vector3()
const TEMP_CAMERA_LOCAL_POSITION = new THREE.Vector3()
const TEMP_CAMERA_OFFSET = new THREE.Vector3()

/**
 * Owns the non-XR orbit camera state and transform.
 *
 * Keyboard, mouse, and touch inputs all call the same orbit/dolly methods.
 * When the camera has not received user input for a configurable delay, it
 * resumes a slow automatic orbit around the active simulation.
 */
export class OrbitCameraController {
  constructor(camera, options = {}) {
    if (!camera) {
      throw new Error('OrbitCameraController requires a camera')
    }

    this.camera = camera
    this.target = options.target ?? new THREE.Vector3(0, 0, -2)
    this.targetOffset =
      options.targetOffset ?? new THREE.Vector3(0, 1.45, 0)

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
      defaultDistance: options.defaultDistance ?? 1.0,
      idleOrbitEnabled: options.idleOrbitEnabled ?? true,
      idleOrbitSpeed:
        options.idleOrbitSpeed ?? THREE.MathUtils.degToRad(3),
      idleOrbitDelay: options.idleOrbitDelay ?? 2.0,
    }

    this.state = {
      initialized: false,
      angle: 0,
      distance: this.settings.defaultDistance,
      height: 1.6,

      // Begin auto-orbiting immediately on initial load and after a view reset.
      idleElapsed: this.settings.idleOrbitDelay,
      activeInteractionCount: 0,
    }

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleWindowBlur = this.handleWindowBlur.bind(this)

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleWindowBlur)
  }

  setTarget(
    target,
    targetOffset = null,
    { resetView = true } = {},
  ) {
    this.target = target

    if (targetOffset) {
      this.targetOffset.copy(targetOffset)
    }

    if (resetView) {
      this.resetView()
    }
  }

  setDefaultDistance(distance, { resetView = true } = {}) {
    if (!Number.isFinite(distance)) {
      return this.settings.defaultDistance
    }

    this.settings.defaultDistance = THREE.MathUtils.clamp(
      distance,
      this.settings.minDistance,
      this.settings.maxDistance,
    )

    if (resetView) {
      this.resetView()
    }

    return this.settings.defaultDistance
  }

  resetView({ angle = 0, height = 1.6 } = {}) {
    this.state.initialized = true
    this.state.angle = angle
    this.state.distance = this.settings.defaultDistance
    this.state.height = height

    this.state.idleElapsed = this.settings.idleOrbitDelay
    this.state.activeInteractionCount = 0

    this.clearKeyboardInput()
    this.updateCameraTransform()
  }

  // Compatibility with older code that called reset().
  reset() {
    this.resetView()
  }

  clearKeyboardInput() {
    this.keys.forward = false
    this.keys.back = false
    this.keys.left = false
    this.keys.right = false
  }

  notifyInteraction() {
    this.state.idleElapsed = 0
  }

  /**
   * Allows an active simulation to disable the shared idle camera orbit.
   * Re-enabling it starts the automatic presentation orbit immediately.
   */
  setIdleOrbitEnabled(enabled) {
    this.settings.idleOrbitEnabled = Boolean(enabled)

    if (this.settings.idleOrbitEnabled) {
      this.state.idleElapsed = this.settings.idleOrbitDelay
    }
  }

  isIdleOrbitEnabled() {
    return this.settings.idleOrbitEnabled
  }

  /**
   * Prevents idle orbit while an external pointer gesture is held active.
   * Calls are counted so this remains safe if more input systems are added.
   */
  beginInteraction() {
    this.state.activeInteractionCount += 1
    this.notifyInteraction()
  }

  /**
   * Releases one external interaction lock and restarts the idle delay.
   */
  endInteraction() {
    this.state.activeInteractionCount = Math.max(
      0,
      this.state.activeInteractionCount - 1,
    )
    this.notifyInteraction()
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
      this.notifyInteraction()
      event.preventDefault()
    }
  }

  handleKeyUp(event) {
    if (this.setKey(event.code, false)) {
      this.notifyInteraction()
      event.preventDefault()
    }
  }

  handleWindowBlur() {
    this.clearKeyboardInput()
    this.notifyInteraction()
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

    this.camera.getWorldPosition(TEMP_CAMERA_WORLD_POSITION)

    TEMP_CAMERA_OFFSET
      .copy(TEMP_CAMERA_WORLD_POSITION)
      .sub(targetPosition)

    TEMP_CAMERA_OFFSET.y = 0

    const derivedDistance = TEMP_CAMERA_OFFSET.length()

    this.state.distance = THREE.MathUtils.clamp(
      this.settings.defaultDistance ?? derivedDistance,
      this.settings.minDistance,
      this.settings.maxDistance,
    )

    if (derivedDistance < 0.001) {
      this.state.angle = 0
    } else {
      this.state.angle = Math.atan2(
        TEMP_CAMERA_OFFSET.x,
        TEMP_CAMERA_OFFSET.z,
      )
    }

    this.state.height = TEMP_CAMERA_WORLD_POSITION.y
    this.state.initialized = true
  }

  ensureInitialized() {
    if (!this.state.initialized) {
      this.initialize()
    }
  }

  /**
   * Positive values orbit right; negative values orbit left.
   */
  applyOrbitDelta(deltaRadians) {
    if (!Number.isFinite(deltaRadians)) return

    this.ensureInitialized()
    this.notifyInteraction()
    this.state.angle += deltaRadians
  }

  /**
   * Positive values move farther away; negative values move closer.
   */
  applyDollyDelta(deltaDistance) {
    if (!Number.isFinite(deltaDistance)) return

    this.ensureInitialized()
    this.notifyInteraction()
    this.state.distance = THREE.MathUtils.clamp(
      this.state.distance + deltaDistance,
      this.settings.minDistance,
      this.settings.maxDistance,
    )
  }

  updateCameraTransform() {
    const targetPosition = this.getTargetPosition()

    TEMP_CAMERA_WORLD_POSITION.set(
      targetPosition.x +
        Math.sin(this.state.angle) * this.state.distance,
      this.state.height,
      targetPosition.z +
        Math.cos(this.state.angle) * this.state.distance,
    )

    if (this.camera.parent) {
      this.camera.parent.updateWorldMatrix(true, false)

      TEMP_CAMERA_LOCAL_POSITION.copy(
        TEMP_CAMERA_WORLD_POSITION,
      )
      this.camera.parent.worldToLocal(
        TEMP_CAMERA_LOCAL_POSITION,
      )
      this.camera.position.copy(
        TEMP_CAMERA_LOCAL_POSITION,
      )
    } else {
      this.camera.position.copy(
        TEMP_CAMERA_WORLD_POSITION,
      )
    }

    this.camera.lookAt(targetPosition)
  }

  update(deltaTime) {
    this.ensureInitialized()

    const orbitInput =
      (this.keys.right ? 1 : 0) -
      (this.keys.left ? 1 : 0)

    const dollyInput =
      (this.keys.back ? 1 : 0) -
      (this.keys.forward ? 1 : 0)

    const hasKeyboardInput =
      orbitInput !== 0 || dollyInput !== 0

    if (hasKeyboardInput) {
      this.applyOrbitDelta(
        orbitInput * this.settings.orbitSpeed * deltaTime,
      )
      this.applyDollyDelta(
        dollyInput * this.settings.dollySpeed * deltaTime,
      )
    } else if (this.state.activeInteractionCount === 0) {
      this.state.idleElapsed += deltaTime

      if (
        this.settings.idleOrbitEnabled &&
        this.state.idleElapsed >= this.settings.idleOrbitDelay
      ) {
        // Modify the angle directly so idle motion does not reset its own timer.
        this.state.angle +=
          this.settings.idleOrbitSpeed * deltaTime
      }
    }

    this.updateCameraTransform()
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleWindowBlur)

    this.clearKeyboardInput()
    this.state.activeInteractionCount = 0
  }
}
