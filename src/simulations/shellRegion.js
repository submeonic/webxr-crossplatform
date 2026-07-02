import * as THREE from 'three'

import { generate1sSamples } from './orbitals/orbitalSamplers.js'
import { createFresnelShellMaterial } from './orbitals/createFresnelShellMaterial.js'
import { createOrbitalPointCloud } from './orbitals/createOrbitalPointCloud.js'
import { createRadialGraphPanel } from './orbitals/createRadialGraphPanel.js'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.45

/*
  Main 1s tuning values.

  Physics units:
    rMaxA0, shellThicknessA0, shellOuterRadiusA0 are in Bohr radii.

  Render scale:
    a0ToMeters controls how physically large the cloud feels in XR.
*/
const ELECTRON_COUNT = 1500
const R_MAX_A0 = 5.0
const A0_TO_METERS = 0.25

const ELECTRON_RADIUS_METERS = 0.012
const NUCLEUS_RADIUS_METERS = 0.045

const SHELL_THICKNESS_A0 = 0.15
const INITIAL_SHELL_OUTER_RADIUS_A0 = 1.15

const SHELL_DRAG_GAIN_A0_PER_METER = 1.25

const GRAPH_WORLD_POSITION = new THREE.Vector3()
const CAMERA_WORLD_POSITION = new THREE.Vector3()
const GRAPH_LOOK_TARGET = new THREE.Vector3()

export function createShellRegionSimulation(app) {
  const group = new THREE.Group()
  group.name = 'Hydrogen1sOrbitalSimulation'

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'Hydrogen1sPresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'Hydrogen1sContentAnchor'
  contentAnchor.position.set(0, CONTENT_HEIGHT, 0)
  simulationRoot.add(contentAnchor)

  const samples = generate1sSamples({
    count: ELECTRON_COUNT,
    rMaxA0: R_MAX_A0,
    a0ToMeters: A0_TO_METERS,
    seed: 1001,
  })

  const pointCloud = createOrbitalPointCloud({
    samples,
    electronRadius: ELECTRON_RADIUS_METERS,
    baseColor: 0xeadfad,
    baseOpacity: 0.18,
    highlightColor: 0xfff1bf,
    highlightOpacity: 0.95,
  })

  contentAnchor.add(pointCloud.group)

  const nucleus = createNucleus()
  contentAnchor.add(nucleus)

  const shellGroup = new THREE.Group()
  shellGroup.name = 'ConstantThicknessFresnelShell'
  contentAnchor.add(shellGroup)

  const shellGeometry = new THREE.SphereGeometry(1, 96, 48)

  const outerShellMaterial = createFresnelShellMaterial({
    color: 0xfff1bf,
    baseAlpha: 0.005,
    fresnelAlpha: 1.0,
    fresnelPower: 5.0,
  })

  const innerShellMaterial = createFresnelShellMaterial({
    color: 0xfff1bf,
    baseAlpha: 0.005,
    fresnelAlpha: 1.0,
    fresnelPower: 5.0,
  })

  const outerShell = new THREE.Mesh(
    shellGeometry,
    outerShellMaterial,
  )

  outerShell.name = 'OuterFresnelShell'
  outerShell.renderOrder = 10

  const innerShell = new THREE.Mesh(
    shellGeometry,
    innerShellMaterial,
  )

  innerShell.name = 'InnerFresnelShell'
  innerShell.renderOrder = 11

  shellGroup.add(outerShell)
  shellGroup.add(innerShell)

  const graphPanel = createRadialGraphPanel({
    samples,
    rMaxA0: R_MAX_A0,
    bins: 70,
    widthMeters: 1.5,
    heightMeters: 0.84,
    title: 'Hydrogen 1s orbital',
  })

  /*
    Graph placement:
      X negative = left
      Z negative = farther back into the scene
  */
  graphPanel.mesh.position.set(-1.45, CONTENT_HEIGHT, 0.0)
  simulationRoot.add(graphPanel.mesh)

  const shellState = {
    outerRadiusA0: INITIAL_SHELL_OUTER_RADIUS_A0,
    innerRadiusA0: INITIAL_SHELL_OUTER_RADIUS_A0 - SHELL_THICKNESS_A0,
    highlightedCount: 0,
  }

  const radiusInteraction = {
    active: false,
    handedness: null,
    startY: 0,
    startOuterRadiusA0: shellState.outerRadiusA0,
  }

  function setShellOuterRadiusA0(nextOuterRadiusA0) {
    shellState.outerRadiusA0 = THREE.MathUtils.clamp(
      nextOuterRadiusA0,
      SHELL_THICKNESS_A0,
      R_MAX_A0,
    )

    shellState.innerRadiusA0 = Math.max(
      shellState.outerRadiusA0 - SHELL_THICKNESS_A0,
      0.001,
    )

    const outerRadiusMeters =
      shellState.outerRadiusA0 * A0_TO_METERS

    const innerRadiusMeters =
      shellState.innerRadiusA0 * A0_TO_METERS

    /*
      Constant-thickness shell:
      The user controls outer radius.
      Inner radius is computed so the shell gap remains fixed.
    */
    outerShell.scale.setScalar(outerRadiusMeters)
    innerShell.scale.setScalar(innerRadiusMeters)

    shellState.highlightedCount = pointCloud.updateHighlight(
      shellState.innerRadiusA0,
      shellState.outerRadiusA0,
    )

    graphPanel.update({
      innerRadiusA0: shellState.innerRadiusA0,
      outerRadiusA0: shellState.outerRadiusA0,
      highlightedCount: shellState.highlightedCount,
      totalCount: ELECTRON_COUNT,
    })
  }

  function updateGraphBillboard() {
    graphPanel.mesh.getWorldPosition(GRAPH_WORLD_POSITION)
    app.camera.getWorldPosition(CAMERA_WORLD_POSITION)

    /*
      Yaw-only billboard:
      The graph turns left/right to face the camera,
      but it stays vertically upright.
    */
    GRAPH_LOOK_TARGET.copy(CAMERA_WORLD_POSITION)
    GRAPH_LOOK_TARGET.y = GRAPH_WORLD_POSITION.y

    graphPanel.mesh.lookAt(GRAPH_LOOK_TARGET)
  }

  function getPinchStartedHand(interactionState) {
    const right = interactionState.right
    const left = interactionState.left

    if (right?.pinchStarted) {
      return {
        handedness: 'right',
        hand: right,
      }
    }

    if (left?.pinchStarted) {
      return {
        handedness: 'left',
        hand: left,
      }
    }

    return null
  }

  function endRadiusInteraction() {
    radiusInteraction.active = false
    radiusInteraction.handedness = null
  }

  setShellOuterRadiusA0(INITIAL_SHELL_OUTER_RADIUS_A0)

  app.scene.add(group)

  return {
    name: 'shell',
    group,
    simulationRoot,
    contentAnchor,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(0, CONTENT_HEIGHT, 0),

    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
    },

    exit() {
      group.visible = false
      endRadiusInteraction()
    },

    handleInput(interactionState) {
      /*
        Either hand can start the shell adjustment.
        Once one hand starts, that hand owns the interaction until release.
      */
      if (!radiusInteraction.active) {
        const started = getPinchStartedHand(interactionState)

        if (started) {
          radiusInteraction.active = true
          radiusInteraction.handedness = started.handedness
          radiusInteraction.startY = started.hand.pinchPosition.y
          radiusInteraction.startOuterRadiusA0 = shellState.outerRadiusA0
        }
      }

      if (!radiusInteraction.active) return

      const activeHand =
        interactionState[radiusInteraction.handedness]

      if (
        !activeHand ||
        activeHand.pinchEnded ||
        !activeHand.pinchActive
      ) {
        endRadiusInteraction()
        return
      }

      const dragY =
        activeHand.pinchPosition.y - radiusInteraction.startY

      const nextOuterRadiusA0 =
        radiusInteraction.startOuterRadiusA0 +
        dragY * SHELL_DRAG_GAIN_A0_PER_METER

      setShellOuterRadiusA0(nextOuterRadiusA0)
    },

    update() {
      updateGraphBillboard()
    },

    dispose() {
      app.scene.remove(group)

      nucleus.geometry.dispose()
      nucleus.material.dispose()

      shellGeometry.dispose()
      outerShellMaterial.dispose()
      innerShellMaterial.dispose()

      pointCloud.dispose()
      graphPanel.dispose()
    },
  }
}

function createNucleus() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(
      NUCLEUS_RADIUS_METERS,
      32,
      24,
    ),
    new THREE.MeshStandardMaterial({
      color: 0x4cff9a,
      emissive: 0x0a4424,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.95,
      roughness: 0.35,
      metalness: 0.0,
    }),
  )
}