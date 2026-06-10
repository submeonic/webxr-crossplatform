import * as THREE from 'three'

const REQUIRED_JOINTS = [
  'wrist',

  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',

  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',

  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',

  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',

  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip'
]

const DEFAULT_HAND_PROFILES = {
  quest: {
    right: {
      fistThreshold: 0.6,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.0,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false
    },

    left: {
      fistThreshold: 0.6,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.0,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false
    }
  },

  vision: {
    right: {
      fistThreshold: 0.1,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.15,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false
    },

    left: {
      fistThreshold: 0.1,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.15,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false
    }
  }
}

function cloneProfiles(profiles) {
  return structuredClone
    ? structuredClone(profiles)
    : JSON.parse(JSON.stringify(profiles))
}

function mergeProfiles(baseProfiles, overrideProfiles = {}) {
  const merged = cloneProfiles(baseProfiles)

  for (const profileName of Object.keys(overrideProfiles)) {
    merged[profileName] ??= {}

    for (const hand of Object.keys(overrideProfiles[profileName])) {
      merged[profileName][hand] = {
        ...(merged[profileName][hand] ?? {}),
        ...overrideProfiles[profileName][hand]
      }
    }
  }

  return merged
}

function rotateAxesAroundLocalAxis(axis, vectorsToRotate, degrees) {
  const q = new THREE.Quaternion()

  q.setFromAxisAngle(
    axis.clone().normalize(),
    THREE.MathUtils.degToRad(degrees)
  )

  for (const vector of vectorsToRotate) {
    vector.applyQuaternion(q).normalize()
  }
}

export class HandLocomotionGestureSystem {
  constructor(renderer, options = {}) {
    this.renderer = renderer

    this.settings = {
      profileName: 'quest',

      /*
      These are project-level frame tuning values.

      They intentionally affect:
        thumbLocal
        joystickX / joystickZ
        indicator anchor/orientation
      */
      frameTiltXDegrees: -20,
      frameTiltZDegreesRight: -20,
      frameTiltZDegreesLeft: 20,

      profiles: DEFAULT_HAND_PROFILES,

      ...options
    }

    this.profiles = mergeProfiles(
      DEFAULT_HAND_PROFILES,
      options.profiles
    )

    this.profileName = this.settings.profileName

    this.profile =
      this.profiles[this.profileName] ?? this.profiles.quest

    this.hands = {
      left: this.createHandState('left'),
      right: this.createHandState('right')
    }
  }

  createHandState(handedness) {
    return {
      visible: false,
      handedness,

      fistActive: false,
      fistConfidence: 0,

      profile: this.profile[handedness],

      handScale: 1,

      localOrigin: new THREE.Vector3(),
      localXAxis: new THREE.Vector3(),
      localYAxis: new THREE.Vector3(),
      localZAxis: new THREE.Vector3(),

      rawForwardAxis: new THREE.Vector3(),

      thumbLocal: new THREE.Vector3(),

      neutralThumbLocal: new THREE.Vector3(),
      deltaThumbLocal: new THREE.Vector3(),

      thumbPose: 'neutral',

      /*
      The reusable output:
        joystickX = thumb left/right
        joystickZ = thumb forward/back
      */
      joystickX: 0,
      joystickZ: 0,

      /*
      Backward-compatible aliases.
      */
      moveIntentX: 0,
      moveIntentZ: 0,
      turnIntentY: 0
    }
  }

  update() {
    this.resetHand(this.hands.left)
    this.resetHand(this.hands.right)

    const frame = this.renderer.xr.getFrame()
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    const session = this.renderer.xr.getSession()

    if (!frame || !referenceSpace || !session) return

    for (const inputSource of session.inputSources) {
      if (!inputSource.hand) continue

      const handedness = inputSource.handedness

      if (handedness !== 'left' && handedness !== 'right') {
        continue
      }

      const jointPositions = this.getJointPositions(
        inputSource.hand,
        frame,
        referenceSpace
      )

      if (!jointPositions) continue

      this.updateHandState(
        this.hands[handedness],
        handedness,
        jointPositions
      )
    }
  }

  resetHand(state) {
    state.visible = false
    state.fistActive = false
    state.fistConfidence = 0

    state.thumbPose = 'neutral'

    state.joystickX = 0
    state.joystickZ = 0

    state.moveIntentX = 0
    state.moveIntentZ = 0
    state.turnIntentY = 0
  }

  getJointPositions(hand, frame, referenceSpace) {
    const positions = {}

    for (const jointName of REQUIRED_JOINTS) {
      const joint = hand.get(jointName)
      if (!joint) return null

      const pose = frame.getJointPose(joint, referenceSpace)
      if (!pose) return null

      positions[jointName] = new THREE.Vector3(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z
      )
    }

    return positions
  }

  updateHandState(state, handedness, p) {
    state.visible = true

    const profile = state.profile

    const localFrame = this.computeFistLocalFrame(p, handedness)
    if (!localFrame) return

    state.handScale = localFrame.handScale

    state.localOrigin.copy(localFrame.origin)
    state.localXAxis.copy(localFrame.xAxis)
    state.localYAxis.copy(localFrame.yAxis)
    state.localZAxis.copy(localFrame.zAxis)
    state.rawForwardAxis.copy(localFrame.rawForwardAxis)

    state.fistConfidence = this.computeFistConfidence(p)
    state.fistActive = state.fistConfidence > profile.fistThreshold

    const thumbOffsetWorld = new THREE.Vector3()
      .subVectors(p['thumb-tip'], localFrame.origin)

    state.thumbLocal.set(
      thumbOffsetWorld.dot(localFrame.xAxis) / localFrame.handScale,
      thumbOffsetWorld.dot(localFrame.yAxis) / localFrame.handScale,
      thumbOffsetWorld.dot(localFrame.zAxis) / localFrame.handScale
    )

    state.neutralThumbLocal.set(
      profile.neutralX,
      profile.neutralY,
      profile.neutralZ
    )

    state.deltaThumbLocal
      .copy(state.thumbLocal)
      .sub(state.neutralThumbLocal)

    if (!state.fistActive) {
      state.joystickX = 0
      state.joystickZ = 0

      state.moveIntentX = 0
      state.moveIntentZ = 0
      state.turnIntentY = 0

      state.thumbPose = 'neutral'

      return
    }

    let x = state.deltaThumbLocal.x
    let z = state.deltaThumbLocal.z

    if (profile.invertX) x *= -1
    if (profile.invertZ) z *= -1

    x = this.applyDeadzoneAndGain(
      x,
      profile.deadzoneX,
      profile.gainX
    )

    z = this.applyDeadzoneAndGain(
      z,
      profile.deadzoneZ,
      profile.gainZ
    )

    x = THREE.MathUtils.clamp(x, -1, 1)
    z = THREE.MathUtils.clamp(z, -1, 1)

    state.joystickX = x
    state.joystickZ = z

    state.moveIntentX = x
    state.moveIntentZ = z
    state.turnIntentY = x

    state.thumbPose = this.classifyPoseFromAnalog(x, z)
  }

  computeFistLocalFrame(p, handedness) {
    const indexDistal =
      p['index-finger-phalanx-distal']

    const ringDistal =
      p['ring-finger-phalanx-distal']

    const indexIntermediate =
      p['index-finger-phalanx-intermediate']

    const middleIntermediate =
      p['middle-finger-phalanx-intermediate']

    const pinkyIntermediate =
      p['pinky-finger-phalanx-intermediate']

    const thumbMetacarpal =
      p['thumb-metacarpal']

    /*
    Key solve:
    local Y = ring distal -> index distal.
    This follows the curled front row of the fist better than
    pinky intermediate -> index intermediate.
    */
    let yAxis = new THREE.Vector3()
      .subVectors(indexIntermediate, pinkyIntermediate)
      .normalize()

    /*
    Raw forward candidate:
    thumb metacarpal -> middle intermediate.
    */
    const rawForwardAxis = new THREE.Vector3()
      .subVectors(middleIntermediate, thumbMetacarpal)
      .normalize()

    /*
    Project raw forward onto the plane perpendicular to Y.
    */
    let zAxis = rawForwardAxis
      .clone()
      .sub(
        yAxis
          .clone()
          .multiplyScalar(rawForwardAxis.dot(yAxis))
      )
      .normalize()

    if (zAxis.lengthSq() <= 0.0001) return null

    /*
    Build a clean orthonormal basis.
    This prevents visual scaling/shearing in systems that use the frame.
    */
    let xAxis = new THREE.Vector3()
      .crossVectors(yAxis, zAxis)
      .normalize()

    zAxis = new THREE.Vector3()
      .crossVectors(xAxis, yAxis)
      .normalize()

    yAxis = new THREE.Vector3()
      .crossVectors(zAxis, xAxis)
      .normalize()

    /*
    Tip the control frame around local X.
    */
    rotateAxesAroundLocalAxis(
      xAxis,
      [yAxis, zAxis],
      this.settings.frameTiltXDegrees
    )

    /*
    Mirror Z-roll by hand.
    */
    const zTiltDegrees =
      handedness === 'right'
        ? this.settings.frameTiltZDegreesRight
        : this.settings.frameTiltZDegreesLeft

    rotateAxesAroundLocalAxis(
      zAxis,
      [xAxis, yAxis],
      zTiltDegrees
    )

    const origin = indexDistal.clone()

    /*
    Scale uses the wider stable knuckle span.
    */
    const handScale =
      indexIntermediate.distanceTo(pinkyIntermediate)

    if (handScale <= 0.0001) return null

    return {
      origin,
      xAxis,
      yAxis,
      zAxis,
      rawForwardAxis,
      handScale
    }
  }

  computeFistConfidence(p) {
    const indexMeta = p['index-finger-metacarpal']
    const middleMeta = p['middle-finger-metacarpal']
    const ringMeta = p['ring-finger-metacarpal']
    const pinkyMeta = p['pinky-finger-metacarpal']

    const indexTip = p['index-finger-tip']
    const middleTip = p['middle-finger-tip']
    const ringTip = p['ring-finger-tip']
    const pinkyTip = p['pinky-finger-tip']

    const handScale = indexMeta.distanceTo(pinkyMeta)

    if (handScale <= 0.0001) return 0

    const pairs = [
      [indexTip, indexMeta],
      [middleTip, middleMeta],
      [ringTip, ringMeta],
      [pinkyTip, pinkyMeta]
    ]

    let curledTotal = 0

    for (const [tip, meta] of pairs) {
      const d = tip.distanceTo(meta) / handScale

      const curl = THREE.MathUtils.clamp(
        1.0 - (d - 1.15) / 0.75,
        0,
        1
      )

      curledTotal += curl
    }

    return curledTotal / pairs.length
  }

  applyDeadzoneAndGain(value, deadzone, gain) {
    const absValue = Math.abs(value)

    if (absValue < deadzone) return 0

    const sign = Math.sign(value)

    const normalized =
      (absValue - deadzone) / Math.max(0.0001, 1.0 - deadzone)

    return sign * normalized * gain
  }

  classifyPoseFromAnalog(x, z) {
    const absX = Math.abs(x)
    const absZ = Math.abs(z)

    if (Math.max(absX, absZ) < 0.05) {
      return 'neutral'
    }

    if (absX > absZ) {
      return x > 0 ? 'right' : 'left'
    }

    return z > 0 ? 'forward' : 'back'
  }
}