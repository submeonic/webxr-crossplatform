import * as THREE from 'three'

import { RadialScaleControlSystem } from '../../systems/scaling/RadialScaleControlSystem.js'

import { generate1sSamples } from './data/sOrbitalSamplers.js'
import { createFresnelShellMaterial } from './rendering/createFresnelShellMaterial.js'
import { createOrbitalPointCloud } from './rendering/createOrbitalPointCloud.js'
import { createRadialGraphPanel } from './ui/createRadialGraphPanel.js'
import { createDesktopRadialGraph } from './ui/createDesktopRadialGraph.js'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.45

/*
Main 1s tuning values.

Physics units:
rMaxA0, shellThicknessA0, and shellOuterRadiusA0 are in Bohr radii.

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

export function createSOrbitalSimulation(app) {
  const group = new THREE.Group()
  group.name = 'SOrbitalSimulation'

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'SOrbitalPresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'SOrbitalContentAnchor'
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
    widthMeters: 1.5,
    heightMeters: 0.84,
  })

  /*
  Graph placement:
  X negative = left
  Z negative = farther back into the scene
  */
  graphPanel.mesh.position.set(-1.45, CONTENT_HEIGHT, 0.0)
  simulationRoot.add(graphPanel.mesh)

  const orbitalState = {
    orbitalType: '1s',
  }

  const shellState = {
    outerRadiusA0: INITIAL_SHELL_OUTER_RADIUS_A0,
    innerRadiusA0: INITIAL_SHELL_OUTER_RADIUS_A0 - SHELL_THICKNESS_A0,
    highlightedCount: 0,
  }

  let radialScaleControl = null

  const desktopGraph = createDesktopRadialGraph({
    containerId: 's-orbitals-desktop-graph',
    samples,
    minRadiusA0: SHELL_THICKNESS_A0,
    maxRadiusA0: R_MAX_A0,

    onRadiusChange(nextRadiusA0) {
      if (!radialScaleControl) {
        return
      }

      radialScaleControl.setValue(
        nextRadiusA0,
        'desktop-graph-drag',
      )
    },
  })

  function getGraphState() {
    return {
      orbitalType: orbitalState.orbitalType,
      innerRadiusA0: shellState.innerRadiusA0,
      outerRadiusA0: shellState.outerRadiusA0,
      highlightedCount: shellState.highlightedCount,
      totalCount: ELECTRON_COUNT,
    }
  }

  function updateGraphs() {
    const graphState = getGraphState()

    graphPanel.update(graphState)
    desktopGraph.update(graphState)
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

    const outerRadiusMeters = shellState.outerRadiusA0 * A0_TO_METERS
    const innerRadiusMeters = shellState.innerRadiusA0 * A0_TO_METERS

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

    updateGraphs()
  }

  radialScaleControl = new RadialScaleControlSystem({
    initialValue: shellState.outerRadiusA0,
    minValue: SHELL_THICKNESS_A0,
    maxValue: R_MAX_A0,
    dragGain: SHELL_DRAG_GAIN_A0_PER_METER,
    handPriority: ['right', 'left'],
    onChange: setShellOuterRadiusA0,
  })

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

  function setOrbitalType(nextOrbitalType) {
    if (nextOrbitalType !== '1s') {
      console.warn(
        `[SOrbitalSimulation] Unsupported orbital type: ${nextOrbitalType}. Only "1s" is implemented right now.`,
      )

      return orbitalState.orbitalType
    }

    orbitalState.orbitalType = nextOrbitalType
    updateGraphs()

    return orbitalState.orbitalType
  }

  setShellOuterRadiusA0(INITIAL_SHELL_OUTER_RADIUS_A0)

  app.scene.add(group)

  return {
    name: 's-orbitals',
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
      radialScaleControl.reset()
    },

    handleInput(interactionState, context = {}) {
      if (!context.isXR) {
        return
      }

      radialScaleControl.update(interactionState)
    },

    update(deltaTime, context = {}) {
      const isXR = Boolean(context.isXR)

      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(!isXR)

      if (isXR) {
        updateGraphBillboard()
      }
    },

    getOrbitalType() {
      return orbitalState.orbitalType
    },

    setOrbitalType,

    getRadialScaleControlState() {
      return radialScaleControl.getState()
    },

    setShellOuterRadiusA0(nextOuterRadiusA0) {
      return radialScaleControl.setValue(
        nextOuterRadiusA0,
        'external-set',
      )
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
      desktopGraph.dispose()
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