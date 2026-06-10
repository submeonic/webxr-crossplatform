import './style.css'

import * as THREE from 'three'

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

import { HandDebugSystem } from './systems/HandDebugSystem.js'
import { HandLocomotionGestureSystem } from './systems/HandLocomotionGestureSystem.js'
import { HandLocomotionSystem } from './systems/HandLocomotionSystem.js'
import { HandLocomotionIndicator } from './systems/HandLocomotionIndicator.js'
import { XRDebugPanel } from './systems/XRDebugPanel.js'

/*
====================================================
DEVICE PROFILE
====================================================
*/

const FORCE_PROFILE = null
// const FORCE_PROFILE = 'quest'
// const FORCE_PROFILE = 'vision'

function detectDeviceProfile() {
  const ua = navigator.userAgent || ''

  if (/OculusBrowser|Quest|Meta Quest/i.test(ua)) {
    return 'quest'
  }

  return 'vision'
}

const ACTIVE_HAND_PROFILE =
  FORCE_PROFILE ?? detectDeviceProfile()

/*
====================================================
CODE TOGGLES
====================================================
*/

const SHOW_HAND_MODELS = true
const SHOW_HAND_DEBUG_JOINTS = false
const SHOW_HAND_DEBUG_AXES = false
const SHOW_XR_DEBUG_PANEL = false

/*
====================================================
SCENE
====================================================
*/

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x101010)

/*
====================================================
CAMERA + PLAYER RIG

Important:
WebXR updates the camera pose from headset tracking.
Artificial locomotion should move/rotate playerRig, not camera.
====================================================
*/

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.01,
  100
)

camera.position.set(0, 1.6, 3)

const playerRig = new THREE.Group()
playerRig.name = 'PlayerRig'
playerRig.add(camera)
scene.add(playerRig)

/*
====================================================
RENDERER
====================================================
*/

const renderer = new THREE.WebGLRenderer({
  antialias: true
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)

renderer.xr.enabled = true

document.body.appendChild(renderer.domElement)

/*
====================================================
WEBXR BUTTON
====================================================
*/

document.body.appendChild(
  VRButton.createButton(renderer, {
    optionalFeatures: [
      'local-floor',
      'bounded-floor',
      'hand-tracking'
    ]
  })
)

/*
====================================================
LIGHTS
====================================================
*/

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2)
scene.add(hemiLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 2)
dirLight.position.set(1, 3, 2)
scene.add(dirLight)

/*
====================================================
FLOOR
====================================================
*/

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({
    color: 0x222222
  })
)

floor.rotation.x = -Math.PI / 2
floor.position.y = 0

scene.add(floor)

/*
====================================================
TEST SPHERE
====================================================
*/

const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0xff4444
})

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 64, 64),
  sphereMaterial
)

sphere.position.set(0, 1.5, -2)

scene.add(sphere)

/*
====================================================
SELECTION
====================================================
*/

const raycaster = new THREE.Raycaster()
const tempMatrix = new THREE.Matrix4()

let selected = false

function toggleSphereSelection() {
  selected = !selected

  sphere.material.color.set(
    selected ? 0x00ff00 : 0xff4444
  )
}

function handleSelection(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld)

  raycaster.ray.origin.setFromMatrixPosition(
    controller.matrixWorld
  )

  raycaster.ray.direction
    .set(0, 0, -1)
    .applyMatrix4(tempMatrix)

  const intersects = raycaster.intersectObject(sphere)

  if (intersects.length > 0) {
    toggleSphereSelection()
  }
}

/*
====================================================
CONTROLLERS + HANDS

Important:
Controllers, grips, and hands are parented to playerRig.
====================================================
*/

const controllerModelFactory = new XRControllerModelFactory()
const handModelFactory = new XRHandModelFactory()

for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i)

  controller.addEventListener('selectstart', () => {
    handleSelection(controller)
  })

  playerRig.add(controller)

  const grip = renderer.xr.getControllerGrip(i)

  grip.add(
    controllerModelFactory.createControllerModel(grip)
  )

  playerRig.add(grip)

  const hand = renderer.xr.getHand(i)

  if (SHOW_HAND_MODELS) {
    hand.add(
      handModelFactory.createHandModel(hand, 'mesh')
    )
  }

  playerRig.add(hand)
}

/*
====================================================
DESKTOP MOUSE SELECTION
====================================================
*/

window.addEventListener('click', (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  )

  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObject(sphere)

  if (intersects.length > 0) {
    toggleSphereSelection()
  }
})

/*
====================================================
HAND LOCOMOTION SYSTEMS
====================================================
*/

const handLocomotionGestureSystem =
  new HandLocomotionGestureSystem(renderer, {
    profileName: ACTIVE_HAND_PROFILE,

    /*
    These are gesture-frame tuning values.
    They affect both the thumb joystick math and the indicator orientation.
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

    /*
    mode:
      'dpad' = one input at a time
      'analog' = continuous joystick
    */
    mode: 'dpad',

    dpadThreshold: 0.45,

    /*
    Default behavior:
      joystick Z = forward/back movement
      joystick X = turn left/right

    No strafing by default.
    */
    allowStrafe: false,

    moveSpeed: 0.8,
    strafeSpeed: 0.7,
    turnSpeed: 0.8,

    smoothing: 6.0,

    /*
    Keep -1 if your turning direction currently feels correct.
    Flip to 1 if left/right is inverted.
    */
    turnSign: -1,

    activeHandPreference: 'right'
  })
/*
====================================================
HAND DEBUG
====================================================
*/

const handDebugSystem = new HandDebugSystem(playerRig, renderer, {
  showJoints: SHOW_HAND_DEBUG_JOINTS,
  showAxes: SHOW_HAND_DEBUG_AXES,
  jointSize: 0.012,
  axisLength: 0.09,

  // Important:
  // Axes are now drawn from the final calculated gesture frame.
  gestureSystem: handLocomotionGestureSystem
})

const handLocomotionIndicator =
  new HandLocomotionIndicator(playerRig, {
    modelPath: '/models/dpad_wedge.glb',

    /*
    Your current tuned indicator scale.
    */
    dpadDiameter: 0.07,

    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,

    pressDepth: 0.001,
    activeScale: 0.965
  })

/*
====================================================
XR DEBUG PANEL
====================================================
*/

const xrDebugPanel = new XRDebugPanel(camera)

/*
====================================================
DESKTOP KEYBOARD FALLBACK
====================================================
*/

const desktopOrbitKeys = {
  forward: false,
  back: false,
  left: false,
  right: false
}

const desktopOrbitSettings = {
  orbitSpeed: 1.5,
  dollySpeed: 2.0,
  minDistance: 0.75,
  maxDistance: 12.0
}

const desktopOrbitState = {
  initialized: false,
  angle: 0,
  distance: 5,
  height: 1.6
}

function setDesktopOrbitKey(code, pressed) {
  if (code === 'KeyW' || code === 'ArrowUp') {
    desktopOrbitKeys.forward = pressed
    return true
  }

  if (code === 'KeyS' || code === 'ArrowDown') {
    desktopOrbitKeys.back = pressed
    return true
  }

  if (code === 'KeyA' || code === 'ArrowLeft') {
    desktopOrbitKeys.left = pressed
    return true
  }

  if (code === 'KeyD' || code === 'ArrowRight') {
    desktopOrbitKeys.right = pressed
    return true
  }

  return false
}

window.addEventListener('keydown', (e) => {
  if (setDesktopOrbitKey(e.code, true)) {
    e.preventDefault()
  }
})

window.addEventListener('keyup', (e) => {
  if (setDesktopOrbitKey(e.code, false)) {
    e.preventDefault()
  }
})

function initializeDesktopOrbitFallback() {
  const target = sphere.position

  const offset = camera.position.clone().sub(target)
  offset.y = 0

  desktopOrbitState.distance = THREE.MathUtils.clamp(
    offset.length(),
    desktopOrbitSettings.minDistance,
    desktopOrbitSettings.maxDistance
  )

  desktopOrbitState.angle = Math.atan2(offset.x, offset.z)
  desktopOrbitState.height = camera.position.y

  desktopOrbitState.initialized = true
}

function updateDesktopOrbitFallback(deltaTime) {
  if (!desktopOrbitState.initialized) {
    initializeDesktopOrbitFallback()
  }

  const target = sphere.position

  const orbitInput =
    (desktopOrbitKeys.right ? 1 : 0) -
    (desktopOrbitKeys.left ? 1 : 0)

  const dollyInput =
    (desktopOrbitKeys.back ? 1 : 0) -
    (desktopOrbitKeys.forward ? 1 : 0)

  desktopOrbitState.angle +=
    orbitInput *
    desktopOrbitSettings.orbitSpeed *
    deltaTime

  desktopOrbitState.distance +=
    dollyInput *
    desktopOrbitSettings.dollySpeed *
    deltaTime

  desktopOrbitState.distance = THREE.MathUtils.clamp(
    desktopOrbitState.distance,
    desktopOrbitSettings.minDistance,
    desktopOrbitSettings.maxDistance
  )

  camera.position.set(
    target.x +
      Math.sin(desktopOrbitState.angle) *
      desktopOrbitState.distance,

    desktopOrbitState.height,

    target.z +
      Math.cos(desktopOrbitState.angle) *
      desktopOrbitState.distance
  )

  camera.lookAt(target)
}

/*
====================================================
RESIZE
====================================================
*/

window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth / window.innerHeight

  camera.updateProjectionMatrix()

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  )
})

/*
====================================================
ANIMATION LOOP
====================================================
*/

const clock = new THREE.Clock()

/*
====================================================
ANIMATION LOOP
====================================================
*/

renderer.setAnimationLoop(() => {
  const deltaTime = clock.getDelta()

  let locomotionState

  if (renderer.xr.isPresenting) {
    /*
    XR MODE

    Hand gesture system reads hand joints.
    Hand locomotion system moves playerRig.
    */
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
    /*
    DESKTOP MODE

    Keyboard orbit fallback directly moves camera.
    WASD / arrows:
      W / Up    = dolly in
      S / Down  = dolly out
      A / Left  = orbit left
      D / Right = orbit right
    */
    updateDesktopOrbitFallback(deltaTime)

    locomotionState = {
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

  /*
  Keep the hand locomotion indicator alive.
  In desktop mode, activeHand is null, so it should hide / idle.
  */
  handLocomotionIndicator.update({
    activeHand: locomotionState.activeHand,
    direction: locomotionState.direction,
    deltaTime
  })

  /*
  XR DEBUG PANEL
  */
  if (SHOW_XR_DEBUG_PANEL) {
    const left = handLocomotionGestureSystem.hands.left
    const right = handLocomotionGestureSystem.hands.right

    xrDebugPanel.setLines([
      `PROFILE: ${ACTIVE_HAND_PROFILE.toUpperCase()}`,
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

  /*
  HAND DEBUG VISUALS
  */
  if (SHOW_HAND_DEBUG_JOINTS || SHOW_HAND_DEBUG_AXES) {
    handDebugSystem.update()
  }

  renderer.render(scene, camera)
})