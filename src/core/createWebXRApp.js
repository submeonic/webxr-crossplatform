import * as THREE from 'three'

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'
import { OrbitCameraController } from '../systems/navigation/OrbitCameraController.js'
import { WebInteractionController } from '../systems/navigation/WebInteractionController.js'
import { PalmNavigationSystem } from '../systems/navigation/PalmNavigationSystem.js'
import { HandDebugSystem } from '../systems/debug/HandDebugSystem.js'
import { XRDebugPanel } from '../systems/debug/XRDebugPanel.js'
import { HandLocomotionGestureSystem } from '../systems/locomotion/HandLocomotionGestureSystem.js'
import { HandLocomotionSystem } from '../systems/locomotion/HandLocomotionSystem.js'
import { HandLocomotionIndicator } from '../systems/locomotion/HandLocomotionIndicator.js'
import { HandInteractionSystem } from '../systems/interaction/HandInteractionSystem.js'
import { PinchDragIndicator } from '../systems/interaction/PinchDragIndicator.js'

export function createWebXRApp(options = {}) {
  const container = options.container
  const xrButtonContainer = options.xrButtonContainer
  const viewerStatus = options.viewerStatus ?? null
  const xrUiRoot = options.xrUiRoot ?? document.documentElement

  if (!container) {
    throw new Error('createWebXRApp requires options.container')
  }

  if (!xrButtonContainer) {
    throw new Error('createWebXRApp requires options.xrButtonContainer')
  }

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x101010)

  const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 100)
  camera.position.set(0, 1.6, 3)

  const playerRig = new THREE.Group()
  playerRig.name = 'PlayerRig'
  playerRig.add(camera)
  scene.add(playerRig)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true
  container.appendChild(renderer.domElement)

  const xrButton = VRButton.createButton(renderer, {
    optionalFeatures: [
      'local-floor',
      'bounded-floor',
      'hand-tracking',
    ],
  })

  xrButtonContainer.appendChild(xrButton)

  function setXRAvailabilityState(state) {
    const isChecking = state === 'checking'
    const isAvailable = state === 'available'
    const isUnavailable = state === 'unavailable'

    xrUiRoot.classList.toggle('xr-checking', isChecking)
    xrUiRoot.classList.toggle('xr-available', isAvailable)
    xrUiRoot.classList.toggle('xr-unavailable', isUnavailable)

    xrButtonContainer.classList.toggle('xr-checking', isChecking)
    xrButtonContainer.classList.toggle('xr-available', isAvailable)
    xrButtonContainer.classList.toggle('xr-unavailable', isUnavailable)

    // VRButton writes its own inline display styles, while the site stylesheet
    // also styles the button with display: inline-flex !important. Hide the
    // entire container with an inline !important declaration so unsupported
    // browsers never show the large "WEBXR NOT AVAILABLE" fallback button.
    if (isAvailable) {
      xrButtonContainer.hidden = false
      xrButton.hidden = false
      xrButtonContainer.style.removeProperty('display')
    } else {
      xrButton.hidden = true
      xrButtonContainer.hidden = true
      xrButtonContainer.style.setProperty(
        'display',
        'none',
        'important',
      )
    }

    if (!viewerStatus) return

    viewerStatus.classList.toggle('xr-checking', isChecking)
    viewerStatus.classList.toggle('xr-available', isAvailable)
    viewerStatus.classList.toggle('xr-unavailable', isUnavailable)

    if (isChecking) {
      viewerStatus.textContent = 'Checking XR…'
    } else if (isAvailable) {
      viewerStatus.textContent = 'Desktop / XR Ready'
    } else {
      viewerStatus.textContent = 'XR unavailable'
    }
  }

  async function refreshXRAvailability() {
    setXRAvailabilityState('checking')

    let isSupported = false

    if (navigator.xr?.isSessionSupported) {
      try {
        isSupported = await navigator.xr.isSessionSupported(
          'immersive-vr',
        )
      } catch (error) {
        console.warn(
          'Unable to determine immersive WebXR support:',
          error,
        )
      }
    }

    setXRAvailabilityState(
      isSupported ? 'available' : 'unavailable',
    )

    return isSupported
  }

  const xrAvailabilityPromise = refreshXRAvailability()

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 2)
  dirLight.position.set(1, 3, 2)
  scene.add(dirLight)

  const controllerModelFactory = new XRControllerModelFactory()
  const handModelFactory = new XRHandModelFactory()

  const xrHands = []
  const showHandModels = options.showHandModels ?? true

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i)
    playerRig.add(controller)

    const grip = renderer.xr.getControllerGrip(i)
    grip.add(controllerModelFactory.createControllerModel(grip))
    playerRig.add(grip)

    const hand = renderer.xr.getHand(i)
    hand.name = i === 0 ? 'XRHand_Left' : 'XRHand_Right'
    hand.visible = false

    if (showHandModels) {
      const handModel = handModelFactory.createHandModel(hand, 'mesh')
      handModel.name = i === 0 ? 'XRHandModel_Left' : 'XRHandModel_Right'
      hand.add(handModel)
    }

    playerRig.add(hand)
    xrHands.push(hand)
  }

  const activeHandProfile = options.activeHandProfile ?? detectDeviceProfile()

  const handLocomotionGestureSystem = new HandLocomotionGestureSystem(renderer, {
    profileName: activeHandProfile,
    frameTiltXDegrees: -20,
    frameTiltZDegreesRight: -20,
    frameTiltZDegreesLeft: 20,
  })

  const handLocomotionSystem = new HandLocomotionSystem({
    playerRig,
    camera,
    gestureSystem: handLocomotionGestureSystem,

    mode: 'dpad',
    dpadThreshold: 0.45,

    allowStrafe: false,

    moveSpeed: 0.8,
    strafeSpeed: 0.7,
    turnSpeed: 0.5,

    smoothing: 6.0,
    turnSign: -1,

    activeHandPreference: 'right',
  })

  const handLocomotionIndicator = new HandLocomotionIndicator(playerRig, {
    modelPath: `${import.meta.env.BASE_URL}models/dpad_wedge.glb`,

    dpadDiameter: 0.07,

    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,

    pressDepth: 0.001,
    activeScale: 0.965,
  })

  const handInteractionSystem = new HandInteractionSystem(renderer, camera)

  const palmNavigationSystem = new PalmNavigationSystem({
    renderer,
    camera,
    scene,
    trackingRoot: playerRig,
    gestureSystem: handLocomotionGestureSystem,

    settings: options.palmNavigationSettings,
    menuOptions: options.palmNavigationMenuOptions,

    onNavigate: ({ simulation }) => {
      setActiveSimulation(simulation, {
        source: 'xr-palm-menu',
        resetDesktopView: false,
        resetXRPlayerRig: false,
      })
    },

    onExitXR: () => {
      const session = renderer.xr.getSession()
      if (!session) return

      Promise.resolve(session.end()).catch((error) => {
        console.warn('[PalmNavigation] Unable to end XR session:', error)
      })
    },
  })

  const pinchDragIndicator = new PinchDragIndicator(scene, camera, {
    color: options.pinchDragIndicatorColor ?? 0xfff7ae,
    markerRadius: options.pinchDragMarkerRadius ?? 0.012,
    lineLength: options.pinchDragLineLength ?? 0.11,
    maximumVisualDisplacement:
      options.pinchDragMaximumVisualDisplacement ?? 0.16,
  })

  const handDebugSystem = new HandDebugSystem(playerRig, renderer, {
    showJoints: options.showHandDebugJoints ?? false,
    showAxes: options.showHandDebugAxes ?? false,
    jointSize: 0.012,
    axisLength: 0.09,

    gestureSystem: handLocomotionGestureSystem,
  })

  const xrDebugPanel = new XRDebugPanel(camera)

  let activeSimulation = null

  function getActiveWebInteractionProfile() {
    try {
      return (
        activeSimulation?.getWebInteractionProfile?.() ?? null
      )
    } catch (error) {
      console.warn(
        '[createWebXRApp] Active simulation interaction profile failed:',
        error,
      )
      return null
    }
  }

  const orbitCameraController = new OrbitCameraController(camera, {
    orbitSpeed: options.desktopOrbitSpeed ?? 1.5,
    dollySpeed: options.desktopDollySpeed ?? 2.0,
    minDistance: options.desktopMinDistance ?? 0.75,
    maxDistance: options.desktopMaxDistance ?? 12,
    defaultDistance: options.desktopDefaultDistance ?? 2,
    idleOrbitEnabled:
      options.desktopIdleOrbitEnabled ?? true,
    idleOrbitSpeed: THREE.MathUtils.degToRad(
      options.desktopIdleOrbitDegreesPerSecond ?? 3,
    ),
    idleOrbitDelay:
      options.desktopIdleOrbitDelaySeconds ?? 7,
  })

  const webInteractionController = new WebInteractionController({
    element: renderer.domElement,
    orbitCameraController,

    dragActivationPixels:
      options.webDragActivationPixels ??
      options.touchDragActivationPixels ??
      8,
    orbitRadiansPerPixel:
      options.webOrbitRadiansPerPixel ??
      options.touchOrbitRadiansPerPixel ??
      0.006,

    pinchDollyDistancePerPixel:
      options.webPinchDollyDistancePerPixel ?? 0.01,

    wheelDollyDistancePerPixel:
      options.webWheelDollyDistancePerPixel ?? 0.0025,

    getInteractionProfile: getActiveWebInteractionProfile,

    isEnabled: () => !renderer.xr.isPresenting,
  })

  function resetActiveXRInteraction(reason) {
    activeSimulation?.resetXRInteraction?.(reason)
    pinchDragIndicator.hide()
  }

  function resetDesktopView() {
    webInteractionController.reset()
    orbitCameraController.resetView()
  }

  function resetXRPlayerRig() {
    playerRig.position.set(0, 0, 0)
    playerRig.rotation.set(0, 0, 0)

    handLocomotionSystem.reset()
    handInteractionSystem.reset()
    palmNavigationSystem.reset()
  }

  function handleXRSessionStart() {
    webInteractionController.reset()

    // Reset the player once when a new immersive session begins. The active
    // webpage simulation is intentionally preserved.
    resetXRPlayerRig()
    resetActiveXRInteraction('xr-session-start')
  }

  function handleXRSessionEnd() {
    resetActiveXRInteraction('xr-session-end')
    handLocomotionSystem.reset()
    handInteractionSystem.reset()
    palmNavigationSystem.reset()

    // Keep the active simulation and restore predictable desktop framing for it.
    resetDesktopView()
  }

  renderer.xr.addEventListener(
    'sessionstart',
    handleXRSessionStart,
  )
  renderer.xr.addEventListener(
    'sessionend',
    handleXRSessionEnd,
  )

  const updateCallbacks = []

  function onUpdate(callback) {
    updateCallbacks.push(callback)
  }

  function setDesktopOrbitTarget(
    target,
    targetOffset = null,
    setTargetOptions = {},
  ) {
    orbitCameraController.setTarget(
      target,
      targetOffset,
      setTargetOptions,
    )
  }

  function getActiveSimulation() {
    return activeSimulation
  }

  function setActiveSimulation(
    simulation,
    switchOptions = {},
  ) {
    if (!simulation) return false

    const {
      source = 'programmatic',
      resetDesktopView: shouldResetDesktopView = false,
      resetXRPlayerRig: shouldResetXRPlayerRig = false,
    } = switchOptions

    const simulationChanged =
      activeSimulation !== simulation

    if (simulationChanged) {
      resetActiveXRInteraction(
        `simulation-change:${source}`,
      )

      activeSimulation?.exit?.()
      activeSimulation = simulation
      activeSimulation.enter?.()
    }

    palmNavigationSystem.setActiveSimulation(activeSimulation)

    const desktopOrbitTarget =
      activeSimulation?.desktopOrbitTarget ??
      activeSimulation?.simulationRoot ??
      activeSimulation?.orbitTarget

    const desktopOrbitOffset =
      activeSimulation?.desktopOrbitOffset ??
      new THREE.Vector3(0, 1.45, 0)

    const webInitialCameraDistance =
      activeSimulation?.webInitialCameraDistance ??
      options.desktopDefaultDistance ??
      2

    // Update the active simulation's desktop presentation settings without
    // resetting the camera unless the caller's policy explicitly requests it.
    orbitCameraController.setDefaultDistance(
      webInitialCameraDistance,
      { resetView: false },
    )

    if (desktopOrbitTarget) {
      setDesktopOrbitTarget(
        desktopOrbitTarget,
        desktopOrbitOffset,
        { resetView: false },
      )
    }

    const interactionProfile =
      getActiveWebInteractionProfile()

    const idleCameraOrbitEnabled =
      activeSimulation?.idleCameraOrbit ??
      interactionProfile?.idleCameraOrbit ??
      true

    orbitCameraController.setIdleOrbitEnabled(
      idleCameraOrbitEnabled,
    )

    if (shouldResetXRPlayerRig) {
      resetXRPlayerRig()
    }

    if (shouldResetDesktopView) {
      resetDesktopView()
    }

    return simulationChanged
  }

  function resize() {
    const width = container.clientWidth
    const height = container.clientHeight

    if (width <= 0 || height <= 0) return

    renderer.setSize(width, height, false)

    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  window.addEventListener('resize', resize)

  const resizeObserver = new ResizeObserver(() => {
    resize()
  })

  resizeObserver.observe(container)
  resize()

  const clock = new THREE.Clock()

  function getDesktopLocomotionState() {
    return {
      activeHand: null,
      activeHandedness: 'none',
      usingHands: false,

      direction: 'desktop-orbit',

      moveX: 0,
      moveZ: 0,
      turnY: 0,

      currentMoveX: 0,
      currentMoveZ: 0,
      currentTurnY: 0,
    }
  }

  function updateXRHandModelVisibility(isXR) {
    for (const hand of xrHands) {
      if (!isXR || !showHandModels) {
        hand.visible = false
        continue
      }

      const wrist = hand.joints?.wrist
      const indexTip = hand.joints?.['index-finger-tip']
      const thumbTip = hand.joints?.['thumb-tip']

      hand.visible = Boolean(
        wrist?.visible ||
        indexTip?.visible ||
        thumbTip?.visible,
      )
    }
  }

  function updateDebugPanel(locomotionState, interactionState) {
    if (!(options.showXRDebugPanel ?? false)) return

    const left = handLocomotionGestureSystem.hands.left
    const right = handLocomotionGestureSystem.hands.right
    const leftInteraction = interactionState.left
    const rightInteraction = interactionState.right

    xrDebugPanel.setLines([
      `PROFILE: ${activeHandProfile.toUpperCase()}`,
      `UA HAS QUEST: ${/OculusBrowser|Quest|Meta Quest/i.test(navigator.userAgent)}`,

      `LOCOMOTION: ${handLocomotionSystem.settings.mode.toUpperCase()}`,
      `ACTIVE HAND: ${locomotionState.activeHandedness.toUpperCase()}`,
      `DIRECTION: ${locomotionState.direction}`,

      '',
      `R visible: ${right.visible}`,
      `R fist: ${right.fistActive}`,
      `R confidence: ${right.fistConfidence.toFixed(2)}`,
      `R index curl: ${right.indexCurl.toFixed(2)} ${right.indexCurlPasses ? '✓' : 'x'}`,
      `R middle curl: ${right.middleCurl.toFixed(2)} ${right.middleCurlPasses ? '✓' : 'x'}`,
      `R ring curl: ${right.ringCurl.toFixed(2)} ${right.ringCurlPasses ? '✓' : 'x'}`,
      `R pinky curl: ${right.pinkyCurl.toFixed(2)} ${right.pinkyCurlPasses ? '✓' : 'x'}`,
      `R pose: ${right.thumbPose}`,
      `R thumb X: ${right.thumbLocal.x.toFixed(2)}`,
      `R thumb Y: ${right.thumbLocal.y.toFixed(2)}`,
      `R thumb Z: ${right.thumbLocal.z.toFixed(2)}`,
      `R delta X: ${right.deltaThumbLocal.x.toFixed(2)}`,
      `R delta Z: ${right.deltaThumbLocal.z.toFixed(2)}`,
      `R joyX: ${right.joystickX.toFixed(2)}`,
      `R joyZ: ${right.joystickZ.toFixed(2)}`,
      '',
      `L visible: ${left.visible}`,
      `L fist: ${left.fistActive}`,
      `L confidence: ${left.fistConfidence.toFixed(2)}`,
      `L index curl: ${left.indexCurl.toFixed(2)} ${left.indexCurlPasses ? '✓' : 'x'}`,
      `L middle curl: ${left.middleCurl.toFixed(2)} ${left.middleCurlPasses ? '✓' : 'x'}`,
      `L ring curl: ${left.ringCurl.toFixed(2)} ${left.ringCurlPasses ? '✓' : 'x'}`,
      `L pinky curl: ${left.pinkyCurl.toFixed(2)} ${left.pinkyCurlPasses ? '✓' : 'x'}`,
      `L pose: ${left.thumbPose}`,
      `L thumb X: ${left.thumbLocal.x.toFixed(2)}`,
      `L thumb Y: ${left.thumbLocal.y.toFixed(2)}`,
      `L thumb Z: ${left.thumbLocal.z.toFixed(2)}`,
      `L delta X: ${left.deltaThumbLocal.x.toFixed(2)}`,
      `L delta Z: ${left.deltaThumbLocal.z.toFixed(2)}`,
      `L joyX: ${left.joystickX.toFixed(2)}`,
      `L joyZ: ${left.joystickZ.toFixed(2)}`,
      '',

      `R pinch: ${rightInteraction.pinchActive}`,
      `R pinch distance: ${rightInteraction.pinchDistance.toFixed(3)}`,
      `L pinch: ${leftInteraction.pinchActive}`,
      `L pinch distance: ${leftInteraction.pinchDistance.toFixed(3)}`,

      '',

      `moveX: ${locomotionState.moveX.toFixed(2)}`,
      `moveZ: ${locomotionState.moveZ.toFixed(2)}`,
      `turnY: ${locomotionState.turnY.toFixed(2)}`,
      `Rig X: ${playerRig.position.x.toFixed(2)}`,
      `Rig Z: ${playerRig.position.z.toFixed(2)}`,
      `Rig Yaw: ${playerRig.rotation.y.toFixed(2)}`,

      '',

      `Camera X: ${camera.position.x.toFixed(2)}`,
      `Camera Y: ${camera.position.y.toFixed(2)}`,
      `Camera Z: ${camera.position.z.toFixed(2)}`,
    ])

    xrDebugPanel.update()
  }

  function start() {
    renderer.setAnimationLoop(() => {
      const deltaTime = clock.getDelta()
      const isXR = renderer.xr.isPresenting
      let locomotionState
      let interactionState
      let palmNavigationState

      updateXRHandModelVisibility(isXR)

      if (isXR) {
        handLocomotionGestureSystem.update()
        palmNavigationState = palmNavigationSystem.update(deltaTime)

        handInteractionSystem.update()
        interactionState = handInteractionSystem.getState()

        const palmMenuOwnsXRInput =
          palmNavigationState.visible

        if (palmNavigationState.openedThisFrame) {
          resetActiveXRInteraction('palm-navigation-opened')
        }

        const inputContext = {
          app: publicApi,
          deltaTime,
          isXR: true,
          locomotionState: null,
          interactionState,
          palmNavigationState,
        }

        if (!palmMenuOwnsXRInput) {
          activeSimulation?.handleInput?.(
            interactionState,
            inputContext,
          )
        }

        const simulationOwnsXRInput =
          !palmMenuOwnsXRInput &&
          Boolean(
            activeSimulation?.isXRInteractionActive?.(),
          )

        locomotionState = handLocomotionSystem.update(
          deltaTime,
          {
            fallbackIntent: {
              moveX: 0,
              moveZ: 0,
              turnY: 0,
            },
            suppressHands:
              palmMenuOwnsXRInput ||
              simulationOwnsXRInput,
          },
        )
      } else {
        palmNavigationState = palmNavigationSystem.update(deltaTime)
        orbitCameraController.update(deltaTime)
        locomotionState = getDesktopLocomotionState()
        handInteractionSystem.reset()
        interactionState = handInteractionSystem.getState()
      }

      handLocomotionIndicator.update({
        activeHand: locomotionState.activeHand,
        direction: locomotionState.direction,
        deltaTime,
      })

      const simulationContext = {
        app: publicApi,
        deltaTime,
        isXR,
        locomotionState,
        interactionState,
        palmNavigationState,
      }

      activeSimulation?.update?.(deltaTime, simulationContext)

      for (const callback of updateCallbacks) {
        callback(deltaTime, simulationContext)
      }

      updateDebugPanel(locomotionState, interactionState)

      if (
        options.showHandDebugJoints ||
        options.showHandDebugAxes
      ) {
        handDebugSystem.update()
      }

      renderer.render(scene, camera)
      handInteractionSystem.resetTransientState()
    })
  }

  function dispose() {
    renderer.setAnimationLoop(null)

    window.removeEventListener('resize', resize)
    resizeObserver.disconnect()

    renderer.xr.removeEventListener(
      'sessionstart',
      handleXRSessionStart,
    )
    renderer.xr.removeEventListener(
      'sessionend',
      handleXRSessionEnd,
    )

    resetActiveXRInteraction('app-dispose')
    palmNavigationSystem.dispose()
    pinchDragIndicator.dispose()
    webInteractionController.dispose()
    orbitCameraController.dispose()

    if (activeSimulation?.exit) {
      activeSimulation.exit()
    }

    xrUiRoot.classList.remove(
      'xr-checking',
      'xr-available',
      'xr-unavailable',
    )

    renderer.dispose()
  }

  const publicApi = {
    scene,
    camera,
    playerRig,
    renderer,

    orbitCameraController,
    webInteractionController,

    // Temporary compatibility aliases for code using the earlier names.
    desktopFallback: orbitCameraController,
    touchViewportControls: webInteractionController,

    handLocomotionGestureSystem,
    handLocomotionSystem,
    handLocomotionIndicator,
    handInteractionSystem,
    palmNavigationSystem,
    pinchDragIndicator,
    handDebugSystem,
    xrDebugPanel,
    xrAvailabilityPromise,
    refreshXRAvailability,

    onUpdate,

    setDesktopOrbitTarget,
    resetDesktopView,
    resetXRPlayerRig,

    getActiveSimulation,
    setActiveSimulation,

    start,
    resize,
    dispose,
  }

  return publicApi
}

function detectDeviceProfile() {
  const ua = navigator.userAgent || ''

  if (/OculusBrowser|Quest|Meta Quest/i.test(ua)) {
    return 'quest'
  }

  return 'vision'
}
