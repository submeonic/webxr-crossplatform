import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

import { DesktopOrbitFallback } from './DesktopOrbitFallback.js'

import { HandDebugSystem } from '../systems/HandDebugSystem.js'
import { HandLocomotionGestureSystem } from '../systems/HandLocomotionGestureSystem.js'
import { HandLocomotionSystem } from '../systems/HandLocomotionSystem.js'
import { HandLocomotionIndicator } from '../systems/HandLocomotionIndicator.js'
import { XRDebugPanel } from '../systems/XRDebugPanel.js'

export function createWebXRApp(options = {}) {
  const container = options.container
  const xrButtonContainer = options.xrButtonContainer

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
    alpha: false
  })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true

  container.appendChild(renderer.domElement)

  const xrButton = VRButton.createButton(renderer, {
    optionalFeatures: [
      'local-floor',
      'bounded-floor',
      'hand-tracking'
    ]
  })

  xrButtonContainer.appendChild(xrButton)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 2)
  dirLight.position.set(1, 3, 2)
  scene.add(dirLight)

  const controllerModelFactory = new XRControllerModelFactory()
  const handModelFactory = new XRHandModelFactory()

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i)
    playerRig.add(controller)

    const grip = renderer.xr.getControllerGrip(i)
    grip.add(controllerModelFactory.createControllerModel(grip))
    playerRig.add(grip)

    const hand = renderer.xr.getHand(i)

    if (options.showHandModels ?? true) {
      hand.add(handModelFactory.createHandModel(hand, 'mesh'))
    }

    playerRig.add(hand)
  }

  const activeHandProfile =
    options.activeHandProfile ?? detectDeviceProfile()

  const handLocomotionGestureSystem =
    new HandLocomotionGestureSystem(renderer, {
      profileName: activeHandProfile,

      /*
      Keep your latest hand-frame tuning here.
      Adjust these values if your current files use different final values.
      */
      frameTiltXDegrees: -20,
      frameTiltZDegreesRight: -20,
      frameTiltZDegreesLeft: 20
    })

  const handLocomotionSystem =
    new HandLocomotionSystem({
      playerRig,
      camera,
      gestureSystem: handLocomotionGestureSystem,

      mode: 'dpad',
      dpadThreshold: 0.45,

      allowStrafe: false,

      moveSpeed: 0.8,
      strafeSpeed: 0.7,
      turnSpeed: 0.8,

      smoothing: 6.0,
      turnSign: -1,

      activeHandPreference: 'right'
    })

  const handLocomotionIndicator =
    new HandLocomotionIndicator(playerRig, {
      modelPath: '/models/dpad_wedge.glb',

      dpadDiameter: 0.07,

      offsetX: 0.0,
      offsetY: 0.0,
      offsetZ: 0.0,

      pressDepth: 0.001,
      activeScale: 0.965
    })

  const handDebugSystem =
    new HandDebugSystem(playerRig, renderer, {
      showJoints: options.showHandDebugJoints ?? false,
      showAxes: options.showHandDebugAxes ?? false,
      jointSize: 0.012,
      axisLength: 0.09,
      gestureSystem: handLocomotionGestureSystem
    })

  const xrDebugPanel = new XRDebugPanel(camera)

  const desktopFallback =
    new DesktopOrbitFallback(camera, {
      orbitSpeed: options.desktopOrbitSpeed ?? 1.5,
      dollySpeed: options.desktopDollySpeed ?? 2.0,
      minDistance: options.desktopMinDistance ?? 0.75,
      maxDistance: options.desktopMaxDistance ?? 12
    })

  const updateCallbacks = []

  let activeSimulation = null

  function onUpdate(callback) {
    updateCallbacks.push(callback)
  }

  function setDesktopOrbitTarget(target) {
    desktopFallback.setTarget(target)
  }

  function resetPlayerTransform() {
    playerRig.position.set(0, 0, 0)
    playerRig.rotation.set(0, 0, 0)

    /*
    Desktop fallback directly controls the camera.
    XR mode will override camera pose while presenting.
    */
    camera.position.set(0, 1.6, 3)
    camera.rotation.set(0, 0, 0)

    desktopFallback.reset()
  }

  function setActiveSimulation(simulation) {
    if (!simulation) return
    if (activeSimulation === simulation) return

    if (activeSimulation?.exit) {
      activeSimulation.exit()
    }

    activeSimulation = simulation

    resetPlayerTransform()

    if (activeSimulation?.enter) {
      activeSimulation.enter()
    }

    if (activeSimulation?.orbitTarget) {
      setDesktopOrbitTarget(activeSimulation.orbitTarget)
    }
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
      currentTurnY: 0
    }
  }

  function updateDebugPanel(locomotionState) {
    if (!(options.showXRDebugPanel ?? false)) return

    const left = handLocomotionGestureSystem.hands.left
    const right = handLocomotionGestureSystem.hands.right

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
      `L pose: ${left.thumbPose}`,
      `L thumb X: ${left.thumbLocal.x.toFixed(2)}`,
      `L thumb Y: ${left.thumbLocal.y.toFixed(2)}`,
      `L thumb Z: ${left.thumbLocal.z.toFixed(2)}`,
      `L delta X: ${left.deltaThumbLocal.x.toFixed(2)}`,
      `L delta Z: ${left.deltaThumbLocal.z.toFixed(2)}`,
      `L joyX: ${left.joystickX.toFixed(2)}`,
      `L joyZ: ${left.joystickZ.toFixed(2)}`,
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
      `Camera Z: ${camera.position.z.toFixed(2)}`
    ])

    xrDebugPanel.update()
  }

  function start() {
    renderer.setAnimationLoop(() => {
      const deltaTime = clock.getDelta()

      let locomotionState

      if (renderer.xr.isPresenting) {
        handLocomotionGestureSystem.update()

        locomotionState =
          handLocomotionSystem.update(deltaTime, {
            fallbackIntent: {
              moveX: 0,
              moveZ: 0,
              turnY: 0
            }
          })
      } else {
        desktopFallback.update(deltaTime)
        locomotionState = getDesktopLocomotionState()
      }

      handLocomotionIndicator.update({
        activeHand: locomotionState.activeHand,
        direction: locomotionState.direction,
        deltaTime
      })

      if (activeSimulation?.update) {
        activeSimulation.update(deltaTime)
      }

      for (const callback of updateCallbacks) {
        callback(deltaTime)
      }

      updateDebugPanel(locomotionState)

      if (
        options.showHandDebugJoints ||
        options.showHandDebugAxes
      ) {
        handDebugSystem.update()
      }

      renderer.render(scene, camera)
    })
  }

  function dispose() {
    renderer.setAnimationLoop(null)

    window.removeEventListener('resize', resize)
    resizeObserver.disconnect()

    desktopFallback.dispose()

    if (activeSimulation?.exit) {
      activeSimulation.exit()
    }

    renderer.dispose()
  }

  return {
    scene,
    camera,
    playerRig,
    renderer,

    desktopFallback,

    handLocomotionGestureSystem,
    handLocomotionSystem,
    handLocomotionIndicator,
    handDebugSystem,
    xrDebugPanel,

    onUpdate,
    setDesktopOrbitTarget,
    resetPlayerTransform,
    setActiveSimulation,
    start,
    resize,
    dispose
  }
}

function detectDeviceProfile() {
  const ua = navigator.userAgent || ''

  if (/OculusBrowser|Quest|Meta Quest/i.test(ua)) {
    return 'quest'
  }

  return 'vision'
}