import * as THREE from 'three'

const DEBUG_JOINTS = [
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

function makeSphere(color, radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 12),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false
    })
  )
}

function makeLine(color) {
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(6), 3)
  )

  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.95
  })

  return new THREE.Line(geometry, material)
}

function setLine(line, start, end) {
  const position = line.geometry.attributes.position

  position.setXYZ(0, start.x, start.y, start.z)
  position.setXYZ(1, end.x, end.y, end.z)

  position.needsUpdate = true

  line.geometry.computeBoundingSphere()
}

export class HandDebugSystem {
  constructor(parent, renderer, options = {}) {
    this.parent = parent
    this.renderer = renderer

    this.settings = {
      showJoints: true,
      showAxes: true,

      jointSize: 0.012,
      axisLength: 0.09,

      /*
      Pass your HandLocomotionGestureSystem here.
      When provided, axes come from the final calculated local frame.
      */
      gestureSystem: null,

      ...options
    }

    this.group = new THREE.Group()
    this.group.name = 'HandDebugSystem'
    this.parent.add(this.group)

    this.handGroups = {
      left: this.createHandDebugGroup('left'),
      right: this.createHandDebugGroup('right')
    }
  }

  createHandDebugGroup(handedness) {
    const group = new THREE.Group()
    group.name = `${handedness}HandDebug`
    group.visible = false

    this.group.add(group)

    const joints = {}

    for (const jointName of DEBUG_JOINTS) {
      const sphere = makeSphere(
        handedness === 'left' ? 0x66aaff : 0xffaa66,
        this.settings.jointSize
      )

      sphere.name = `${handedness}_${jointName}`
      sphere.renderOrder = 100

      group.add(sphere)

      joints[jointName] = sphere
    }

    /*
    Final calculated local axes from HandLocomotionGestureSystem:

      X = red
      Y = green
      Z = blue

    These are the actual axes used by:
      thumbLocal
      joystickX / joystickZ
      HandLocomotionIndicator
    */
    const xAxisLine = makeLine(0xff3333)
    const yAxisLine = makeLine(0x33ff66)
    const zAxisLine = makeLine(0x3399ff)

    xAxisLine.name = `${handedness}_CalculatedXAxis`
    yAxisLine.name = `${handedness}_CalculatedYAxis`
    zAxisLine.name = `${handedness}_CalculatedZAxis`

    xAxisLine.renderOrder = 110
    yAxisLine.renderOrder = 110
    zAxisLine.renderOrder = 110

    group.add(xAxisLine)
    group.add(yAxisLine)
    group.add(zAxisLine)

    /*
    Optional helpful line:
    local origin → thumb tip

    This lets you see how thumb movement relates to the calculated frame.
    */
    const thumbLine = makeLine(0xffffff)
    thumbLine.name = `${handedness}_OriginToThumbTip`
    thumbLine.renderOrder = 111
    group.add(thumbLine)

    return {
      group,
      joints,

      axes: {
        x: xAxisLine,
        y: yAxisLine,
        z: zAxisLine,
        thumb: thumbLine
      }
    }
  }

  update() {
    const frame = this.renderer.xr.getFrame()
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    const session = this.renderer.xr.getSession()

    if (!frame || !referenceSpace || !session) {
      this.hideAll()
      return
    }

    this.hideAll()

    for (const inputSource of session.inputSources) {
      if (!inputSource.hand) continue

      const handedness = inputSource.handedness

      if (handedness !== 'left' && handedness !== 'right') continue

      const handDebug = this.handGroups[handedness]
      handDebug.group.visible = true

      if (this.settings.showJoints) {
        this.updateJointSpheres(inputSource.hand, frame, referenceSpace, handDebug)
      } else {
        this.setJointsVisible(handDebug, false)
      }

      if (this.settings.showAxes) {
        this.updateCalculatedAxes(handedness, inputSource.hand, frame, referenceSpace, handDebug)
      } else {
        this.setAxesVisible(handDebug, false)
      }
    }
  }

  hideAll() {
    this.handGroups.left.group.visible = false
    this.handGroups.right.group.visible = false
  }

  setJointsVisible(handDebug, visible) {
    for (const sphere of Object.values(handDebug.joints)) {
      sphere.visible = visible
    }
  }

  setAxesVisible(handDebug, visible) {
    handDebug.axes.x.visible = visible
    handDebug.axes.y.visible = visible
    handDebug.axes.z.visible = visible
    handDebug.axes.thumb.visible = visible
  }

  updateJointSpheres(hand, frame, referenceSpace, handDebug) {
    this.setJointsVisible(handDebug, true)

    for (const jointName of DEBUG_JOINTS) {
      const joint = hand.get(jointName)
      const sphere = handDebug.joints[jointName]

      if (!joint || !sphere) {
        if (sphere) sphere.visible = false
        continue
      }

      const pose = frame.getJointPose(joint, referenceSpace)

      if (!pose) {
        sphere.visible = false
        continue
      }

      sphere.visible = true

      sphere.position.set(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z
      )
    }
  }

  updateCalculatedAxes(handedness, hand, frame, referenceSpace, handDebug) {
    const gestureSystem = this.settings.gestureSystem

    if (!gestureSystem) {
      this.setAxesVisible(handDebug, false)
      return
    }

    const handState = gestureSystem.hands[handedness]

    if (!handState || !handState.visible) {
      this.setAxesVisible(handDebug, false)
      return
    }

    this.setAxesVisible(handDebug, true)

    const origin = handState.localOrigin
    const length = this.settings.axisLength

    const xEnd = origin
      .clone()
      .addScaledVector(handState.localXAxis, length)

    const yEnd = origin
      .clone()
      .addScaledVector(handState.localYAxis, length)

    const zEnd = origin
      .clone()
      .addScaledVector(handState.localZAxis, length)

    setLine(handDebug.axes.x, origin, xEnd)
    setLine(handDebug.axes.y, origin, yEnd)
    setLine(handDebug.axes.z, origin, zEnd)

    const thumbTipJoint = hand.get('thumb-tip')
    const thumbTipPose = thumbTipJoint
      ? frame.getJointPose(thumbTipJoint, referenceSpace)
      : null

    if (thumbTipPose) {
      const thumbTip = new THREE.Vector3(
        thumbTipPose.transform.position.x,
        thumbTipPose.transform.position.y,
        thumbTipPose.transform.position.z
      )

      handDebug.axes.thumb.visible = true
      setLine(handDebug.axes.thumb, origin, thumbTip)
    } else {
      handDebug.axes.thumb.visible = false
    }
  }
}