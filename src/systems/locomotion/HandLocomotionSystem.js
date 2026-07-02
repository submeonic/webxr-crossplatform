import * as THREE from 'three'

export class HandLocomotionSystem {
  constructor(options = {}) {
    this.playerRig = options.playerRig
    this.camera = options.camera
    this.gestureSystem = options.gestureSystem

    if (!this.playerRig) {
      throw new Error(
        '[HandLocomotionSystem] Missing required option: playerRig'
      )
    }

    if (!this.camera) {
      throw new Error(
        '[HandLocomotionSystem] Missing required option: camera'
      )
    }

    if (!this.gestureSystem) {
      throw new Error(
        '[HandLocomotionSystem] Missing required option: gestureSystem'
      )
    }

    this.settings = {
      /*
      'dpad':
        one input at a time:
          forward / back / turn-left / turn-right

      'analog':
        continuous forward/back and turn.
      */
      mode: 'dpad',

      dpadThreshold: 0.45,

      /*
      false:
        joystickX = turn
        joystickZ = forward/back

      true:
        joystickX = strafe
        joystickZ = forward/back
        turn uses fallback/controller if provided
      */
      allowStrafe: false,

      activeHandPreference: 'right',

      moveSpeed: 0.8,
      strafeSpeed: 0.7,
      turnSpeed: 0.8,

      smoothing: 6.0,

      /*
      -1 matches the current rig turn direction from the prototype.
      Flip to 1 if left/right feels inverted.
      */
      turnSign: -1,

      ...options
    }

    delete this.settings.playerRig
    delete this.settings.camera
    delete this.settings.gestureSystem

    this.currentMoveX = 0
    this.currentMoveZ = 0
    this.currentTurnY = 0

    this.targetMoveX = 0
    this.targetMoveZ = 0
    this.targetTurnY = 0

    this.state = {
      activeHand: null,
      activeHandedness: 'none',
      usingHands: false,

      direction: 'keyboard',

      moveX: 0,
      moveZ: 0,
      turnY: 0,

      currentMoveX: 0,
      currentMoveZ: 0,
      currentTurnY: 0
    }
  }

  update(deltaTime, options = {}) {
    const fallbackIntent = options.fallbackIntent ?? {
      moveX: 0,
      moveZ: 0,
      turnY: 0
    }

    const left = this.gestureSystem.hands.left
    const right = this.gestureSystem.hands.right

    const activeHand = this.getActiveHand(left, right)

    const intent = activeHand
      ? this.getHandIntent(activeHand)
      : {
          moveX: fallbackIntent.moveX ?? 0,
          moveZ: fallbackIntent.moveZ ?? 0,
          turnY: fallbackIntent.turnY ?? 0,
          direction: 'keyboard'
        }

    this.setIntent(intent)
    this.applyMovement(deltaTime)

    this.state.activeHand = activeHand
    this.state.activeHandedness =
      activeHand?.handedness ?? 'none'
    this.state.usingHands = activeHand !== null

    this.state.direction = intent.direction

    this.state.moveX = intent.moveX
    this.state.moveZ = intent.moveZ
    this.state.turnY = intent.turnY

    this.state.currentMoveX = this.currentMoveX
    this.state.currentMoveZ = this.currentMoveZ
    this.state.currentTurnY = this.currentTurnY

    return this.state
  }

  getActiveHand(left, right) {
    if (this.settings.activeHandPreference === 'left') {
      if (left.fistActive) return left
      if (right.fistActive) return right
      return null
    }

    if (right.fistActive) return right
    if (left.fistActive) return left
    return null
  }

  getHandIntent(activeHand) {
    const joyX = activeHand.joystickX
    const joyZ = activeHand.joystickZ

    if (this.settings.mode === 'analog') {
      if (this.settings.allowStrafe) {
        return {
          moveX: joyX,
          moveZ: joyZ,
          turnY: 0,
          direction: 'analog-strafe'
        }
      }

      return {
        moveX: 0,
        moveZ: joyZ,
        turnY: joyX,
        direction: 'analog'
      }
    }

    return this.getDpadIntent(joyX, joyZ)
  }

  getDpadIntent(joyX, joyZ) {
    const absX = Math.abs(joyX)
    const absZ = Math.abs(joyZ)

    if (Math.max(absX, absZ) < this.settings.dpadThreshold) {
      return {
        moveX: 0,
        moveZ: 0,
        turnY: 0,
        direction: 'neutral'
      }
    }

    /*
    Dominant-axis D-pad:
    only one action can be active at a time.
    */
    if (absX > absZ) {
      if (this.settings.allowStrafe) {
        return {
          moveX: Math.sign(joyX),
          moveZ: 0,
          turnY: 0,
          direction: joyX > 0 ? 'strafe-right' : 'strafe-left'
        }
      }

      return {
        moveX: 0,
        moveZ: 0,
        turnY: Math.sign(joyX),
        direction: joyX > 0 ? 'turn-right' : 'turn-left'
      }
    }

    return {
      moveX: 0,
      moveZ: Math.sign(joyZ),
      turnY: 0,
      direction: joyZ > 0 ? 'forward' : 'back'
    }
  }

  setIntent({ moveX = 0, moveZ = 0, turnY = 0 }) {
    this.targetMoveX = THREE.MathUtils.clamp(moveX, -1, 1)
    this.targetMoveZ = THREE.MathUtils.clamp(moveZ, -1, 1)
    this.targetTurnY = THREE.MathUtils.clamp(turnY, -1, 1)
  }

  applyMovement(deltaTime) {
    const t = 1.0 - Math.exp(-this.settings.smoothing * deltaTime)

    this.currentMoveX = THREE.MathUtils.lerp(
      this.currentMoveX,
      this.targetMoveX,
      t
    )

    this.currentMoveZ = THREE.MathUtils.lerp(
      this.currentMoveZ,
      this.targetMoveZ,
      t
    )

    this.currentTurnY = THREE.MathUtils.lerp(
      this.currentTurnY,
      this.targetTurnY,
      t
    )

    this.playerRig.rotation.y +=
      this.currentTurnY *
      this.settings.turnSpeed *
      this.settings.turnSign *
      deltaTime

    const cameraWorldQuaternion = new THREE.Quaternion()
    this.camera.getWorldQuaternion(cameraWorldQuaternion)

    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(cameraWorldQuaternion)
    forward.y = 0

    if (forward.lengthSq() > 0.0001) {
      forward.normalize()
    }

    const right = new THREE.Vector3(1, 0, 0)
    right.applyQuaternion(cameraWorldQuaternion)
    right.y = 0

    if (right.lengthSq() > 0.0001) {
      right.normalize()
    }

    const moveVector = new THREE.Vector3()

    moveVector.addScaledVector(
      forward,
      this.currentMoveZ * this.settings.moveSpeed
    )

    moveVector.addScaledVector(
      right,
      this.currentMoveX * this.settings.strafeSpeed
    )

    const maxSpeed = Math.max(
      this.settings.moveSpeed,
      this.settings.strafeSpeed
    )

    if (moveVector.length() > maxSpeed) {
      moveVector.normalize().multiplyScalar(maxSpeed)
    }

    this.playerRig.position.addScaledVector(moveVector, deltaTime)
  }
}