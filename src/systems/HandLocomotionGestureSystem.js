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
  'pinky-finger-tip',
]

const DEFAULT_HAND_PROFILES = {
  quest: {
    right: {
      fingerCurlThreshold: 0.6,
      requireIndexCurlForFist: true,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.0,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false,
    },

    left: {
      fingerCurlThreshold: 0.6,
      requireIndexCurlForFist: true,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.0,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false,
    },
  },

  vision: {
    right: {
      fingerCurlThreshold: 0.6,
      requireIndexCurlForFist: true,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.15,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false,
    },

    left: {
      fingerCurlThreshold: 0.6,
      requireIndexCurlForFist: true,

      neutralX: 0.0,
      neutralY: 0.2,
      neutralZ: 0.15,

      deadzoneX: 0.05,
      deadzoneZ: 0.05,

      gainX: 3.0,
      gainZ: 9.0,

      invertX: true,
      invertZ: false,
    },
  },
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
        ...overrideProfiles[profileName][hand],
      }
    }
  }

  return merged
}

function rotateAxesAroundLocalAxis(axis, vectorsToRotate, degrees) {
  const q = new THREE.Quaternion()

  q.setFromAxisAngle(
    axis.clone().normalize(),
    THREE.MathUtils.degToRad(degrees),
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

      frameTiltXDegrees: -20,
      frameTiltZDegreesRight: -20,
      frameTiltZDegreesLeft: 20,

      curlStartDegrees: 15,
      curlFullDegrees: 95,

      profiles: DEFAULT_HAND_PROFILES,

      ...options,
    }

    this.profiles = mergeProfiles(
      DEFAULT_HAND_PROFILES,
      options.profiles,
    )

    this.profileName = this.settings.profileName

    this.profile =
      this.profiles[this.profileName] ?? this.profiles.quest

    this.hands = {
      left: this.createHandState('left'),
      right: this.createHandState('right'),
    }
  }

  createHandState(handedness) {
    return {
      visible: false,
      handedness,

      fistActive: false,
      fistConfidence: 0,

      indexCurl: 0,
      middleCurl: 0,
      ringCurl: 0,
      pinkyCurl: 0,

      indexCurlPasses: false,
      middleCurlPasses: false,
      ringCurlPasses: false,
      pinkyCurlPasses: false,

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

      joystickX: 0,
      joystickZ: 0,

      moveIntentX: 0,
      moveIntentZ: 0,
      turnIntentY: 0,
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
        referenceSpace,
      )

      if (!jointPositions) continue

      this.updateHandState(
        this.hands[handedness],
        handedness,
        jointPositions,
      )
    }
  }

  resetHand(state) {
    state.visible = false

    state.fistActive = false
    state.fistConfidence = 0

    state.indexCurl = 0
    state.middleCurl = 0
    state.ringCurl = 0
    state.pinkyCurl = 0

    state.indexCurlPasses = false
    state.middleCurlPasses = false
    state.ringCurlPasses = false
    state.pinkyCurlPasses = false

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
        pose.transform.position.z,
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

    const fingerCurlState = this.computeFingerCurlState(p, profile)

    state.fistConfidence = fingerCurlState.fistConfidence
    state.fistActive = fingerCurlState.fistActive

    state.indexCurl = fingerCurlState.index
    state.middleCurl = fingerCurlState.middle
    state.ringCurl = fingerCurlState.ring
    state.pinkyCurl = fingerCurlState.pinky

    state.indexCurlPasses = fingerCurlState.indexPasses
    state.middleCurlPasses = fingerCurlState.middlePasses
    state.ringCurlPasses = fingerCurlState.ringPasses
    state.pinkyCurlPasses = fingerCurlState.pinkyPasses

    const thumbOffsetWorld = new THREE.Vector3()
      .subVectors(p['thumb-tip'], localFrame.origin)

    state.thumbLocal.set(
      thumbOffsetWorld.dot(localFrame.xAxis) / localFrame.handScale,
      thumbOffsetWorld.dot(localFrame.yAxis) / localFrame.handScale,
      thumbOffsetWorld.dot(localFrame.zAxis) / localFrame.handScale,
    )

    state.neutralThumbLocal.set(
      profile.neutralX,
      profile.neutralY,
      profile.neutralZ,
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
      profile.gainX,
    )

    z = this.applyDeadzoneAndGain(
      z,
      profile.deadzoneZ,
      profile.gainZ,
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

    const indexIntermediate =
      p['index-finger-phalanx-intermediate']

    const middleIntermediate =
      p['middle-finger-phalanx-intermediate']

    const pinkyIntermediate =
      p['pinky-finger-phalanx-intermediate']

    const thumbMetacarpal =
      p['thumb-metacarpal']

    let yAxis = new THREE.Vector3()
      .subVectors(indexIntermediate, pinkyIntermediate)
      .normalize()

    const rawForwardAxis = new THREE.Vector3()
      .subVectors(middleIntermediate, thumbMetacarpal)
      .normalize()

    let zAxis = rawForwardAxis
      .clone()
      .sub(
        yAxis
          .clone()
          .multiplyScalar(rawForwardAxis.dot(yAxis)),
      )
      .normalize()

    if (zAxis.lengthSq() <= 0.0001) return null

    let xAxis = new THREE.Vector3()
      .crossVectors(yAxis, zAxis)
      .normalize()

    zAxis = new THREE.Vector3()
      .crossVectors(xAxis, yAxis)
      .normalize()

    yAxis = new THREE.Vector3()
      .crossVectors(zAxis, xAxis)
      .normalize()

    rotateAxesAroundLocalAxis(
      xAxis,
      [yAxis, zAxis],
      this.settings.frameTiltXDegrees,
    )

    const zTiltDegrees =
      handedness === 'right'
        ? this.settings.frameTiltZDegreesRight
        : this.settings.frameTiltZDegreesLeft

    rotateAxesAroundLocalAxis(
      zAxis,
      [xAxis, yAxis],
      zTiltDegrees,
    )

    const origin = indexDistal.clone()

    const handScale =
      indexIntermediate.distanceTo(pinkyIntermediate)

    if (handScale <= 0.0001) return null

    return {
      origin,
      xAxis,
      yAxis,
      zAxis,
      rawForwardAxis,
      handScale,
    }
  }

  computeFingerCurlState(p, profile) {
    const index = this.computeFingerAngleCurl(p, 'index-finger')
    const middle = this.computeFingerAngleCurl(p, 'middle-finger')
    const ring = this.computeFingerAngleCurl(p, 'ring-finger')
    const pinky = this.computeFingerAngleCurl(p, 'pinky-finger')

    const fistConfidence =
      (index + middle + ring + pinky) / 4

    const defaultThreshold =
      profile.fingerCurlThreshold ?? 0.6

    const indexThreshold =
      profile.indexCurlThreshold ?? defaultThreshold

    const middleThreshold =
      profile.middleCurlThreshold ?? defaultThreshold

    const ringThreshold =
      profile.ringCurlThreshold ?? defaultThreshold

    const pinkyThreshold =
      profile.pinkyCurlThreshold ?? defaultThreshold

    const requireIndexCurl =
      profile.requireIndexCurlForFist ?? true

    const indexPasses =
      !requireIndexCurl ||
      index >= indexThreshold

    const middlePasses =
      middle >= middleThreshold

    const ringPasses =
      ring >= ringThreshold

    const pinkyPasses =
      pinky >= pinkyThreshold

    const fistActive =
      indexPasses &&
      middlePasses &&
      ringPasses &&
      pinkyPasses

    return {
      fistActive,
      fistConfidence,

      index,
      middle,
      ring,
      pinky,

      indexPasses,
      middlePasses,
      ringPasses,
      pinkyPasses,
    }
  }

  computeFingerAngleCurl(p, fingerPrefix) {
    const meta =
      p[`${fingerPrefix}-metacarpal`]

    const proximal =
      p[`${fingerPrefix}-phalanx-proximal`]

    const intermediate =
      p[`${fingerPrefix}-phalanx-intermediate`]

    const distal =
      p[`${fingerPrefix}-phalanx-distal`]

    const tip =
      p[`${fingerPrefix}-tip`]

    if (!meta || !proximal || !intermediate || !distal || !tip) {
      return 0
    }

    const s0 = new THREE.Vector3()
      .subVectors(proximal, meta)

    const s1 = new THREE.Vector3()
      .subVectors(intermediate, proximal)

    const s2 = new THREE.Vector3()
      .subVectors(distal, intermediate)

    const s3 = new THREE.Vector3()
      .subVectors(tip, distal)

    if (
      s0.lengthSq() <= 0.000001 ||
      s1.lengthSq() <= 0.000001 ||
      s2.lengthSq() <= 0.000001 ||
      s3.lengthSq() <= 0.000001
    ) {
      return 0
    }

    s0.normalize()
    s1.normalize()
    s2.normalize()
    s3.normalize()

    const bend01 = this.angleBetweenSegmentsDegrees(s0, s1)
    const bend12 = this.angleBetweenSegmentsDegrees(s1, s2)
    const bend23 = this.angleBetweenSegmentsDegrees(s2, s3)

    const weightedBend =
      bend01 * 0.25 +
      bend12 * 0.45 +
      bend23 * 0.30

    return this.normalizeBendToCurl(weightedBend)
  }

  angleBetweenSegmentsDegrees(a, b) {
    const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
    return THREE.MathUtils.radToDeg(Math.acos(dot))
  }

  normalizeBendToCurl(bendDegrees) {
    const start = this.settings.curlStartDegrees
    const full = this.settings.curlFullDegrees

    return THREE.MathUtils.clamp(
      (bendDegrees - start) / Math.max(0.0001, full - start),
      0,
      1,
    )
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