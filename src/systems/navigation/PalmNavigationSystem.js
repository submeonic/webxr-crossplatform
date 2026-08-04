import * as THREE from 'three'

import { PalmNavigationMenu } from './PalmNavigationMenu.js'

const TEMP_WRIST = new THREE.Vector3()
const TEMP_INDEX_METACARPAL = new THREE.Vector3()
const TEMP_MIDDLE_METACARPAL = new THREE.Vector3()
const TEMP_PINKY_METACARPAL = new THREE.Vector3()
const TEMP_CAMERA_POSITION = new THREE.Vector3()
const TEMP_INDEX_TIP_POSITION = new THREE.Vector3()

const TEMP_RAW_UP = new THREE.Vector3()
const TEMP_ACROSS = new THREE.Vector3()
const TEMP_TO_CAMERA = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const TEMP_RIGHT = new THREE.Vector3()
const TEMP_UP = new THREE.Vector3()
const TEMP_NORMAL = new THREE.Vector3()
const TEMP_POSITION = new THREE.Vector3()
const TEMP_MATRIX = new THREE.Matrix4()
const TEMP_QUATERNION = new THREE.Quaternion()

function createHandPoseState(handedness) {
  return {
    handedness,
    tracked: false,
    openPalm: false,
    retainedOpenPalm: false,
    facingScore: -1,
    enterPose: false,
    retainPose: false,
    candidateSeconds: 0,

    palmCenter: new THREE.Vector3(),

    // Anatomical palm basis used for fallback orientation.
    palmRight: new THREE.Vector3(1, 0, 0),
    palmUp: new THREE.Vector3(0, 1, 0),
    palmNormal: new THREE.Vector3(0, 0, 1),

    // Kept separately so the menu can remain positioned toward the
    // fingers even though its visual top now points toward the thumb.
    palmFingerDirection: new THREE.Vector3(0, 1, 0),
  }
}

export class PalmNavigationSystem {
  constructor(options = {}) {
    const {
      renderer,
      camera,
      scene,
      trackingRoot = scene,
      gestureSystem,
      onNavigate = null,
      onExitXR = null,
    } = options

    if (!renderer) {
      throw new Error('PalmNavigationSystem requires renderer')
    }

    if (!camera) {
      throw new Error('PalmNavigationSystem requires camera')
    }

    if (!scene) {
      throw new Error('PalmNavigationSystem requires scene')
    }

    if (!gestureSystem) {
      throw new Error('PalmNavigationSystem requires gestureSystem')
    }

    this.renderer = renderer
    this.camera = camera
    this.scene = scene
    this.trackingRoot = trackingRoot
    this.gestureSystem = gestureSystem
    this.onNavigate = onNavigate
    this.onExitXR = onExitXR

    this.settings = {
      holdSeconds: 0.3,
      graceSeconds: 0.18,

      openCurlEnter: 0.35,
      openCurlExit: 0.55,

      facingEnterDegrees: 40,
      facingExitDegrees: 55,

      menuOffsetUp: 0.105,
      menuOffsetNormal: 0.028,

      positionSmoothing: 18,
      rotationSmoothing: 14,

      activationDelaySeconds: 0.4,
      preferredMenuHand: 'left',

      debugLogging: false,
      debugForceVisible: false,

      ...options.settings,
    }

    this.facingEnterDot = Math.cos(
      THREE.MathUtils.degToRad(
        this.settings.facingEnterDegrees,
      ),
    )

    this.facingExitDot = Math.cos(
      THREE.MathUtils.degToRad(
        this.settings.facingExitDegrees,
      ),
    )

    this.hands = {
      left: createHandPoseState('left'),
      right: createHandPoseState('right'),
    }

    this.menu = new PalmNavigationMenu(
      scene,
      options.menuOptions,
    )

    this.simulationItems = []
    this.simulationById = new Map()
    this.simulationIdByObject = new WeakMap()

    this.state = {
      phase: 'hidden',
      visible: false,
      menuHandedness: null,
      pointerHandedness: null,
      facingScore: -1,
      holdProgress: 0,
      graceProgress: 0,
      openedThisFrame: false,
      closedThisFrame: false,
      activatedItem: null,
    }

    this.ownerHandedness = null
    this.graceElapsed = 0
    this.visibleElapsed = 0
    this.hasMenuTransform = false
    this.inputSourcesByHandedness = { left: null, right: null }
    this.debugLogElapsed = 0
  }

  setSimulations(simulations = {}) {
    this.simulationItems = []
    this.simulationById.clear()
    this.simulationIdByObject = new WeakMap()

    for (const [fallbackId, simulation] of Object.entries(simulations)) {
      if (!simulation) continue

      const metadata =
        simulation.metadata ??
        simulation.xrMenuMetadata ??
        {}

      const id = metadata.id ?? simulation.id ?? fallbackId
      const showInXRMenu = metadata.showInXRMenu ?? false

      if (!showInXRMenu) continue

      const item = {
        id,
        label:
          metadata.xrMenuLabel ??
          metadata.label ??
          simulation.xrMenuLabel ??
          id,
        order:
          metadata.xrMenuOrder ??
          simulation.xrMenuOrder ??
          Number.MAX_SAFE_INTEGER,
        kind: 'simulation',
        simulation,
      }

      this.simulationItems.push(item)
      this.simulationById.set(id, simulation)
      this.simulationIdByObject.set(simulation, id)
    }

    this.simulationItems.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label)
    })

    this.menu.setItems([
      ...this.simulationItems,
      {
        id: 'exit-xr',
        label: 'EXIT XR',
        kind: 'exit',
      },
    ])
  }

  setActiveSimulation(simulation) {
    const simulationId = simulation
      ? this.simulationIdByObject.get(simulation) ??
        simulation.metadata?.id ??
        simulation.id ??
        null
      : null

    this.menu.setActiveSimulationId(simulationId)
  }

  isVisible() {
    return this.state.visible
  }

  getState() {
    return this.state
  }

  getOppositeHandedness(handedness) {
    return handedness === 'left' ? 'right' : 'left'
  }

  update(deltaTime) {
    this.state.openedThisFrame = false
    this.state.closedThisFrame = false
    this.state.activatedItem = null

    if (!this.renderer.xr.isPresenting) {
      if (this.state.visible || this.ownerHandedness) {
        this.reset()
      }
      return this.state
    }

    const frame = this.renderer.xr.getFrame()
    const referenceSpace = this.renderer.xr.getReferenceSpace()
    const session = this.renderer.xr.getSession()

    if (!frame || !referenceSpace || !session) {
      return this.state
    }

    this.trackingRoot.updateWorldMatrix(true, false)

    this.inputSourcesByHandedness.left = null
    this.inputSourcesByHandedness.right = null

    for (const inputSource of session.inputSources) {
      if (!inputSource.hand) continue
      if (
        inputSource.handedness !== 'left' &&
        inputSource.handedness !== 'right'
      ) {
        continue
      }

      this.inputSourcesByHandedness[inputSource.handedness] =
        inputSource
    }

    const viewerPose = frame.getViewerPose(referenceSpace)

    if (!viewerPose) {
      return this.state
    }

    TEMP_CAMERA_POSITION.set(
      viewerPose.transform.position.x,
      viewerPose.transform.position.y,
      viewerPose.transform.position.z,
    )
    this.trackingRoot.localToWorld(TEMP_CAMERA_POSITION)

    this.updateHandPose(
      this.hands.left,
      this.inputSourcesByHandedness.left,
      frame,
      referenceSpace,
      TEMP_CAMERA_POSITION,
    )
    this.updateHandPose(
      this.hands.right,
      this.inputSourcesByHandedness.right,
      frame,
      referenceSpace,
      TEMP_CAMERA_POSITION,
    )

    if (!this.ownerHandedness) {
      this.updateCandidates(deltaTime)
    } else {
      this.updateOwner(deltaTime)
    }

    if (this.ownerHandedness) {
      const owner = this.hands[this.ownerHandedness]
      this.updateMenuTransform(owner, deltaTime)
      this.updateMenuInteraction(frame, referenceSpace)

      this.state.facingScore = owner.facingScore
      this.state.holdProgress = 1
    } else {
      this.menu.setVisible(false)
      this.state.visible = false
      this.state.phase = this.getCandidatePhase()
      this.state.facingScore = Math.max(
        this.hands.left.facingScore,
        this.hands.right.facingScore,
      )
      this.state.holdProgress = Math.max(
        this.hands.left.candidateSeconds,
        this.hands.right.candidateSeconds,
      ) / Math.max(0.0001, this.settings.holdSeconds)
      this.state.holdProgress = THREE.MathUtils.clamp(
        this.state.holdProgress,
        0,
        1,
      )
    }

    if (this.settings.debugLogging) {
      this.debugLogElapsed += deltaTime

      if (this.debugLogElapsed >= 0.5) {
        this.debugLogElapsed = 0

        const summarize = (handState) => ({
          tracked: handState.tracked,
          open: handState.openPalm,
          facing: Number(handState.facingScore.toFixed(3)),
          enter: handState.enterPose,
          candidate: Number(handState.candidateSeconds.toFixed(2)),
        })

        console.log('[PalmNavigation]', {
          phase: this.state.phase,
          left: summarize(this.hands.left),
          right: summarize(this.hands.right),
        })
      }
    }

    return this.state
  }

  getJointWorldPosition(
    hand,
    jointName,
    frame,
    referenceSpace,
    target,
  ) {
    const joint = hand?.get?.(jointName)
    if (!joint) return false

    const pose = frame.getJointPose(joint, referenceSpace)
    if (!pose) return false

    target.set(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z,
    )

    this.trackingRoot.localToWorld(target)
    return true
  }

  updateHandPose(
    handState,
    inputSource,
    frame,
    referenceSpace,
    cameraPosition,
  ) {
    handState.tracked = false
    handState.openPalm = false
    handState.retainedOpenPalm = false
    handState.facingScore = -1
    handState.enterPose = false
    handState.retainPose = false

    const hand = inputSource?.hand
    if (!hand) return

    const hasWrist = this.getJointWorldPosition(
      hand,
      'wrist',
      frame,
      referenceSpace,
      TEMP_WRIST,
    )
    const hasIndex = this.getJointWorldPosition(
      hand,
      'index-finger-metacarpal',
      frame,
      referenceSpace,
      TEMP_INDEX_METACARPAL,
    )
    const hasMiddle = this.getJointWorldPosition(
      hand,
      'middle-finger-metacarpal',
      frame,
      referenceSpace,
      TEMP_MIDDLE_METACARPAL,
    )
    const hasPinky = this.getJointWorldPosition(
      hand,
      'pinky-finger-metacarpal',
      frame,
      referenceSpace,
      TEMP_PINKY_METACARPAL,
    )

    if (!hasWrist || !hasIndex || !hasMiddle || !hasPinky) {
      return
    }

    TEMP_RAW_UP.subVectors(
      TEMP_MIDDLE_METACARPAL,
      TEMP_WRIST,
    )
    TEMP_ACROSS.subVectors(
      TEMP_INDEX_METACARPAL,
      TEMP_PINKY_METACARPAL,
    )

    if (
      TEMP_RAW_UP.lengthSq() <= 0.000001 ||
      TEMP_ACROSS.lengthSq() <= 0.000001
    ) {
      return
    }

    TEMP_RAW_UP.normalize()
    TEMP_ACROSS.normalize()

    // Cross in this order so the normal points out through the palm
    // toward the viewer, rather than through the back of the hand.
    TEMP_NORMAL
      .crossVectors(TEMP_ACROSS, TEMP_RAW_UP)
      .normalize()

    if (handState.handedness === 'left') {
      TEMP_NORMAL.negate()
    }

    /*
     * Preserve an anatomical palm-space basis for fallback use.
     * The final menu roll is resolved in updateMenuTransform(), where
     * local +Z stays on the palm normal and local +Y is stabilized
     * against world up.
     */
    TEMP_UP
      .copy(TEMP_RAW_UP)
      .addScaledVector(
        TEMP_NORMAL,
        -TEMP_RAW_UP.dot(TEMP_NORMAL),
      )

    if (TEMP_UP.lengthSq() <= 0.000001) return
    TEMP_UP.normalize()

    TEMP_RIGHT
      .crossVectors(TEMP_UP, TEMP_NORMAL)
      .normalize()

    TEMP_UP
      .crossVectors(TEMP_NORMAL, TEMP_RIGHT)
      .normalize()

    handState.palmCenter
      .copy(TEMP_WRIST)
      .add(TEMP_INDEX_METACARPAL)
      .add(TEMP_MIDDLE_METACARPAL)
      .add(TEMP_PINKY_METACARPAL)
      .multiplyScalar(0.25)

    handState.palmRight.copy(TEMP_RIGHT)
    handState.palmUp.copy(TEMP_UP)
    handState.palmNormal.copy(TEMP_NORMAL)
    handState.palmFingerDirection.copy(TEMP_RAW_UP)

    TEMP_TO_CAMERA.subVectors(
      cameraPosition,
      handState.palmCenter,
    )

    if (TEMP_TO_CAMERA.lengthSq() <= 0.000001) return
    TEMP_TO_CAMERA.normalize()

    handState.facingScore =
      handState.palmNormal.dot(TEMP_TO_CAMERA)

    const gestureState =
      this.gestureSystem.hands[handState.handedness]

    if (!gestureState?.visible) return

    const curls = [
      gestureState.indexCurl,
      gestureState.middleCurl,
      gestureState.ringCurl,
      gestureState.pinkyCurl,
    ]

    handState.openPalm = curls.every(
      (curl) => curl <= this.settings.openCurlEnter,
    )

    handState.retainedOpenPalm = curls.every(
      (curl) => curl <= this.settings.openCurlExit,
    )

    handState.tracked = true
    handState.enterPose =
      handState.openPalm &&
      handState.facingScore >= this.facingEnterDot

    handState.retainPose =
      handState.retainedOpenPalm &&
      handState.facingScore >= this.facingExitDot
  }

  updateCandidates(deltaTime) {
    if (this.settings.debugForceVisible) {
      const preferred = this.hands[this.settings.preferredMenuHand]
      const fallback = this.hands[
        this.getOppositeHandedness(this.settings.preferredMenuHand)
      ]
      const trackedHand = preferred.tracked ? preferred : fallback

      if (trackedHand.tracked) {
        this.openForHand(trackedHand.handedness)
        return
      }
    }

    for (const handState of Object.values(this.hands)) {
      if (handState.enterPose) {
        handState.candidateSeconds += deltaTime
      } else {
        handState.candidateSeconds = 0
      }
    }

    const completed = Object.values(this.hands).filter(
      (handState) =>
        handState.candidateSeconds >=
        this.settings.holdSeconds,
    )

    if (completed.length === 0) return

    completed.sort((a, b) => {
      if (a.candidateSeconds !== b.candidateSeconds) {
        return b.candidateSeconds - a.candidateSeconds
      }

      if (
        a.handedness === this.settings.preferredMenuHand
      ) {
        return -1
      }

      if (
        b.handedness === this.settings.preferredMenuHand
      ) {
        return 1
      }

      return 0
    })

    this.openForHand(completed[0].handedness)
  }

  openForHand(handedness) {
    this.ownerHandedness = handedness
    this.graceElapsed = 0
    this.visibleElapsed = 0
    this.hasMenuTransform = false

    this.state.phase = 'visible'
    this.state.visible = true
    this.state.menuHandedness = handedness
    this.state.pointerHandedness =
      this.getOppositeHandedness(handedness)
    this.state.openedThisFrame = true
    this.state.graceProgress = 0

    for (const handState of Object.values(this.hands)) {
      handState.candidateSeconds = 0
    }

    this.menu.resetInteraction()
    this.menu.setVisible(true)
  }

  updateOwner(deltaTime) {
    const owner = this.hands[this.ownerHandedness]

    if (owner.retainPose) {
      this.graceElapsed = 0
      this.state.phase = 'visible'
      this.state.graceProgress = 0
    } else {
      this.graceElapsed += deltaTime
      this.state.phase = 'grace-period'
      this.state.graceProgress = THREE.MathUtils.clamp(
        this.graceElapsed /
          Math.max(0.0001, this.settings.graceSeconds),
        0,
        1,
      )

      if (this.graceElapsed >= this.settings.graceSeconds) {
        this.close()
        return
      }
    }

    this.visibleElapsed += deltaTime
    this.state.visible = true
  }

  updateMenuTransform(owner, deltaTime) {
    if (!owner.tracked) return

    TEMP_POSITION
      .copy(owner.palmCenter)
      .addScaledVector(
        owner.palmFingerDirection,
        this.settings.menuOffsetUp,
      )
      .addScaledVector(
        owner.palmNormal,
        this.settings.menuOffsetNormal,
      )

    /*
     * Keep the menu on the palm plane, but remove palm roll:
     *   local +Z follows the outward palm normal
     *   local +Y is world up projected onto the palm plane
     *   local +X completes the right-handed frame
     *
     * This is equivalent to rotating around the menu's local Z axis
     * until the top of the menu is as upright as the palm plane allows.
     */
    TEMP_NORMAL.copy(owner.palmNormal).normalize()

    TEMP_UP
      .copy(WORLD_UP)
      .addScaledVector(
        TEMP_NORMAL,
        -WORLD_UP.dot(TEMP_NORMAL),
      )

    // A horizontal palm plane makes world-up projection undefined.
    // In that rare pose, fall back to the anatomical palm-up axis.
    if (TEMP_UP.lengthSq() <= 0.000001) {
      TEMP_UP.copy(owner.palmUp)
    }

    TEMP_UP.normalize()

    TEMP_RIGHT
      .crossVectors(TEMP_UP, TEMP_NORMAL)
      .normalize()

    TEMP_UP
      .crossVectors(TEMP_NORMAL, TEMP_RIGHT)
      .normalize()

    TEMP_MATRIX.makeBasis(
      TEMP_RIGHT,
      TEMP_UP,
      TEMP_NORMAL,
    )
    TEMP_QUATERNION.setFromRotationMatrix(TEMP_MATRIX)

    if (!this.hasMenuTransform) {
      this.menu.group.position.copy(TEMP_POSITION)
      this.menu.group.quaternion.copy(TEMP_QUATERNION)
      this.hasMenuTransform = true
    } else {
      const positionAlpha =
        1 - Math.exp(-this.settings.positionSmoothing * deltaTime)
      const rotationAlpha =
        1 - Math.exp(-this.settings.rotationSmoothing * deltaTime)

      this.menu.group.position.lerp(
        TEMP_POSITION,
        positionAlpha,
      )
      this.menu.group.quaternion.slerp(
        TEMP_QUATERNION,
        rotationAlpha,
      )
    }

    this.menu.group.updateMatrixWorld(true)
  }

  updateMenuInteraction(frame, referenceSpace) {
    const pointerHandedness =
      this.getOppositeHandedness(this.ownerHandedness)
    const pointerSource =
      this.inputSourcesByHandedness[pointerHandedness]

    let pointerPosition = null

    if (
      this.getJointWorldPosition(
        pointerSource?.hand,
        'index-finger-tip',
        frame,
        referenceSpace,
        TEMP_INDEX_TIP_POSITION,
      )
    ) {
      pointerPosition = TEMP_INDEX_TIP_POSITION
    }

    const interactionEnabled =
      this.visibleElapsed >=
      this.settings.activationDelaySeconds

    const activatedItem = this.menu.updatePointer(
      pointerPosition,
      interactionEnabled,
    )

    if (!activatedItem) return

    this.state.activatedItem = activatedItem

    if (activatedItem.kind === 'simulation') {
      const simulation =
        activatedItem.simulation ??
        this.simulationById.get(activatedItem.id)

      if (simulation) {
        this.onNavigate?.({
          id: activatedItem.id,
          simulation,
          source: 'xr-palm-menu',
        })
      }

      return
    }

    if (activatedItem.kind === 'exit') {
      this.onExitXR?.()
    }
  }

  getCandidatePhase() {
    const hasCandidate = Object.values(this.hands).some(
      (handState) => handState.candidateSeconds > 0,
    )

    return hasCandidate ? 'candidate' : 'hidden'
  }

  close() {
    const wasVisible = this.state.visible

    this.ownerHandedness = null
    this.graceElapsed = 0
    this.visibleElapsed = 0
    this.hasMenuTransform = false

    this.state.phase = 'hidden'
    this.state.visible = false
    this.state.menuHandedness = null
    this.state.pointerHandedness = null
    this.state.facingScore = -1
    this.state.holdProgress = 0
    this.state.graceProgress = 0
    this.state.closedThisFrame = wasVisible

    for (const handState of Object.values(this.hands)) {
      handState.candidateSeconds = 0
    }

    this.menu.setVisible(false)
    this.menu.resetInteraction()
  }

  reset() {
    this.close()
    this.state.openedThisFrame = false
    this.state.closedThisFrame = false
    this.state.activatedItem = null

    this.inputSourcesByHandedness.left = null
    this.inputSourcesByHandedness.right = null
    this.debugLogElapsed = 0

    for (const handState of Object.values(this.hands)) {
      handState.tracked = false
      handState.openPalm = false
      handState.retainedOpenPalm = false
      handState.facingScore = -1
      handState.enterPose = false
      handState.retainPose = false
      handState.candidateSeconds = 0
    }
  }

  dispose() {
    this.reset()
    this.menu.dispose()
  }
}
