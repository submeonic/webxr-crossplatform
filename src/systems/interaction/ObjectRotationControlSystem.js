import * as THREE from 'three'

const WORLD_X = new THREE.Vector3(1, 0, 0)
const WORLD_Y = new THREE.Vector3(0, 1, 0)

const TEMP_DELTA_QUATERNION = new THREE.Quaternion()
const TEMP_CORRECTION_QUATERNION = new THREE.Quaternion()
const TEMP_CURRENT_AXIS = new THREE.Vector3()
const TEMP_SIGNED_AXIS = new THREE.Vector3()

const DEFAULT_ORIENTATIONS = [
  {
    id: '2px',
    label: '2px',
    axis: new THREE.Vector3(1, 0, 0),
  },
  {
    id: '2py',
    label: '2py',
    axis: new THREE.Vector3(0, 1, 0),
  },
  {
    id: '2pz',
    label: '2pz',
    axis: new THREE.Vector3(0, 0, 1),
  },
]

function cloneOrientations(orientations) {
  return orientations.map((orientation) => ({
    ...orientation,
    axis: orientation.axis.clone().normalize(),
  }))
}

/**
 * Rotates an Object3D around fixed world X/Y axes and snaps its primary
 * local axis to the nearest named world-axis orientation on release.
 */
export class ObjectRotationControlSystem {
  constructor(options = {}) {
    if (!options.target) {
      throw new Error(
        'ObjectRotationControlSystem requires options.target',
      )
    }

    this.target = options.target

    this.localPrimaryAxis = (
      options.localPrimaryAxis ??
      new THREE.Vector3(1, 0, 0)
    )
      .clone()
      .normalize()

    this.orientations = cloneOrientations(
      options.orientations ?? DEFAULT_ORIENTATIONS,
    )

    this.settings = {
      webYawRadiansPerPixel:
        options.webYawRadiansPerPixel ?? 0.008,
      webPitchRadiansPerPixel:
        options.webPitchRadiansPerPixel ?? 0.008,

      xrYawRadiansPerMeter:
        options.xrYawRadiansPerMeter ?? 7.0,
      xrPitchRadiansPerMeter:
        options.xrPitchRadiansPerMeter ?? 7.0,

      snapSpeed: options.snapSpeed ?? 10,
      snapEpsilonRadians:
        options.snapEpsilonRadians ??
        THREE.MathUtils.degToRad(0.35),

      handPriority: options.handPriority ?? [
        'right',
        'left',
      ],
    }

    this.onOrientationChange =
      options.onOrientationChange ?? null

    this.snapTargetQuaternion =
      this.target.quaternion.clone()

    this.state = {
      active: false,
      activeSource: null,
      activeHandedness: null,
      snapping: false,
      orientationId: null,
      orientationLabel: null,
    }

    this.updateOrientationCandidate(true)
  }

  begin(source = 'external', handedness = null) {
    if (this.state.active) {
      return (
        this.state.activeSource === source &&
        this.state.activeHandedness === handedness
      )
    }

    this.state.active = true
    this.state.activeSource = source
    this.state.activeHandedness = handedness
    this.state.snapping = false

    return true
  }

  end(reason = 'interaction-end') {
    if (!this.state.active) return false

    this.state.active = false
    this.state.activeSource = null
    this.state.activeHandedness = null

    this.beginSnapToNearest(reason)
    return true
  }

  applyWorldRotation(axis, radians) {
    if (!Number.isFinite(radians)) return
    if (Math.abs(radians) < 1e-8) return

    TEMP_DELTA_QUATERNION.setFromAxisAngle(
      axis,
      radians,
    )

    // Premultiplication applies the rotation in the parent/world frame.
    this.target.quaternion
      .premultiply(TEMP_DELTA_QUATERNION)
      .normalize()

    this.state.snapping = false
    this.updateOrientationCandidate()
  }

  applyWebHorizontalDelta(deltaX) {
    this.applyWorldRotation(
      WORLD_Y,
      deltaX * this.settings.webYawRadiansPerPixel,
    )
  }

  applyWebVerticalDelta(deltaY) {
    this.applyWorldRotation(
      WORLD_X,
      deltaY * this.settings.webPitchRadiansPerPixel,
    )
  }

  updateXR(interactionState) {
    if (!interactionState) return

    if (
      this.state.active &&
      this.state.activeSource === 'xr'
    ) {
      const hand =
        interactionState[this.state.activeHandedness]

      if (
        !hand?.visible ||
        hand.pinchEnded ||
        !hand.pinchActive
      ) {
        this.end('xr-pinch-release')
        return
      }

      // Same fixed world-axis mapping as desktop/touch.
      const yawRadians =
        hand.pinchDelta.x *
        this.settings.xrYawRadiansPerMeter

      const pitchRadians =
        -hand.pinchDelta.y *
        this.settings.xrPitchRadiansPerMeter

      this.applyWorldRotation(WORLD_Y, yawRadians)
      this.applyWorldRotation(WORLD_X, pitchRadians)
      return
    }

    if (this.state.active) return

    for (const handedness of this.settings.handPriority) {
      const hand = interactionState[handedness]

      if (
        hand?.visible &&
        hand.pinchStarted &&
        hand.pinchActive
      ) {
        this.begin('xr', handedness)
        return
      }
    }
  }

  update(deltaTime) {
    if (
      this.state.active ||
      !this.state.snapping
    ) {
      return
    }

    const angleRemaining =
      this.target.quaternion.angleTo(
        this.snapTargetQuaternion,
      )

    if (
      angleRemaining <=
      this.settings.snapEpsilonRadians
    ) {
      this.target.quaternion.copy(
        this.snapTargetQuaternion,
      )
      this.state.snapping = false
      return
    }

    const t =
      1 -
      Math.exp(
        -this.settings.snapSpeed *
          Math.max(deltaTime, 0),
      )

    this.target.quaternion.slerp(
      this.snapTargetQuaternion,
      THREE.MathUtils.clamp(t, 0, 1),
    )
  }

  getCurrentWorldPrimaryAxis(
    target = new THREE.Vector3(),
  ) {
    return target
      .copy(this.localPrimaryAxis)
      .applyQuaternion(this.target.quaternion)
      .normalize()
  }

  findNearestOrientation() {
    this.getCurrentWorldPrimaryAxis(
      TEMP_CURRENT_AXIS,
    )

    let best = this.orientations[0]
    let bestAbsoluteDot = -Infinity
    let bestSignedDot = 1

    for (const orientation of this.orientations) {
      const dot =
        TEMP_CURRENT_AXIS.dot(orientation.axis)
      const absoluteDot = Math.abs(dot)

      if (absoluteDot > bestAbsoluteDot) {
        best = orientation
        bestAbsoluteDot = absoluteDot
        bestSignedDot = dot
      }
    }

    TEMP_SIGNED_AXIS
      .copy(best.axis)
      .multiplyScalar(bestSignedDot >= 0 ? 1 : -1)

    return {
      orientation: best,
      signedAxis: TEMP_SIGNED_AXIS.clone(),
      alignment: bestAbsoluteDot,
    }
  }

  updateOrientationCandidate(force = false) {
    const nearest = this.findNearestOrientation()

    this.setOrientationState(
      nearest.orientation,
      force,
    )

    return nearest
  }

  setOrientationState(orientation, force = false) {
    const changed =
      this.state.orientationId !== orientation.id

    this.state.orientationId = orientation.id
    this.state.orientationLabel = orientation.label

    if (
      (changed || force) &&
      typeof this.onOrientationChange === 'function'
    ) {
      this.onOrientationChange({
        id: orientation.id,
        label: orientation.label,
      })
    }
  }

  beginSnapToNearest(_reason = 'snap') {
    const nearest = this.findNearestOrientation()

    this.setOrientationState(
      nearest.orientation,
    )

    this.getCurrentWorldPrimaryAxis(
      TEMP_CURRENT_AXIS,
    )

    TEMP_CORRECTION_QUATERNION.setFromUnitVectors(
      TEMP_CURRENT_AXIS,
      nearest.signedAxis,
    )

    this.snapTargetQuaternion
      .copy(this.target.quaternion)
      .premultiply(TEMP_CORRECTION_QUATERNION)
      .normalize()

    const angle =
      this.target.quaternion.angleTo(
        this.snapTargetQuaternion,
      )

    this.state.snapping =
      angle > this.settings.snapEpsilonRadians

    if (!this.state.snapping) {
      this.target.quaternion.copy(
        this.snapTargetQuaternion,
      )
    }

    return nearest.orientation.id
  }

  reset(
    reason = 'reset',
    {
      immediate = false,
    } = {},
  ) {
    this.state.active = false
    this.state.activeSource = null
    this.state.activeHandedness = null

    this.beginSnapToNearest(reason)

    if (immediate) {
      this.target.quaternion.copy(
        this.snapTargetQuaternion,
      )
      this.state.snapping = false
    }
  }

  isActive() {
    return this.state.active
  }

  isXRActive() {
    return (
      this.state.active &&
      this.state.activeSource === 'xr'
    )
  }

  getState() {
    return {
      active: this.state.active,
      activeSource: this.state.activeSource,
      activeHandedness: this.state.activeHandedness,
      snapping: this.state.snapping,
      orientationId: this.state.orientationId,
      orientationLabel: this.state.orientationLabel,
    }
  }
}
