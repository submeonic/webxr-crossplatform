import * as THREE from 'three'

import { RadialScaleControlSystem } from '../../systems/scaling/RadialScaleControlSystem.js'

import { createFresnelShellMaterial } from './rendering/createFresnelShellMaterial.js'
import { createNucleus } from './rendering/createNucleus.js'
import { createOrbitalPointCloud } from './rendering/createOrbitalPointCloud.js'
import { createDesktopRadialGraph } from './ui/createDesktopRadialGraph.js'
import { createRadialGraphPanel } from './ui/createRadialGraphPanel.js'

const GRAPH_WORLD_POSITION = new THREE.Vector3()
const CAMERA_WORLD_POSITION = new THREE.Vector3()
const GRAPH_LOOK_TARGET = new THREE.Vector3()

export function createSOrbitalSimulationBase(app, config) {
  validateConfig(config)

  const presentationOffset =
    config.presentationOffset ?? new THREE.Vector3(0, 0, -2)
  const contentHeight = config.contentHeight ?? 1.45
  const shellThicknessA0 = config.shellThicknessA0 ?? 0.15
  const shellMinimumA0 = config.shellMinRadiusA0 ?? shellThicknessA0
  const shellMaximumA0 = config.shellMaxRadiusA0
  const a0ToMeters = config.a0ToMeters ?? 0.25

  const group = new THREE.Group()
  group.name = `${config.label}OrbitalSimulation`

  const simulationRoot = new THREE.Group()
  simulationRoot.name = `${config.label}OrbitalPresentationRoot`
  simulationRoot.position.copy(presentationOffset)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = `${config.label}OrbitalContentAnchor`
  contentAnchor.position.set(0, contentHeight, 0)
  simulationRoot.add(contentAnchor)

  const samples = config.sampleGenerator({
    count: config.electronCount ?? 1800,
    seed: config.seed,
    maxRadiusA0: config.sampleMaxRadiusA0,
    a0ToMeters,
  })

  const pointCloud = createOrbitalPointCloud({
    samples,
    electronRadius: config.electronRadiusMeters ?? 0.012,
    baseColor: config.pointColor,
    baseOpacity: config.pointOpacity ?? 0.18,
    highlightColor: config.highlightColor,
    highlightOpacity: config.highlightOpacity ?? 0.95,
  })

  contentAnchor.add(pointCloud.group)

  const nucleus = createNucleus({
    radiusMeters: config.nucleusRadiusMeters ?? 0.045,
  })

  contentAnchor.add(nucleus.mesh)

  const shellGroup = new THREE.Group()
  shellGroup.name = `${config.label}ConstantThicknessFresnelShell`
  contentAnchor.add(shellGroup)

  const shellGeometry = new THREE.SphereGeometry(1, 96, 48)
  const shellMaterialOptions = {
    color: config.shellColor,
    baseAlpha: config.shellBaseAlpha ?? 0.005,
    fresnelAlpha: config.shellFresnelAlpha ?? 1,
    fresnelPower: config.shellFresnelPower ?? 5,
  }

  const outerShellMaterial = createFresnelShellMaterial(
    shellMaterialOptions,
  )
  const innerShellMaterial = createFresnelShellMaterial(
    shellMaterialOptions,
  )

  const outerShell = new THREE.Mesh(
    shellGeometry,
    outerShellMaterial,
  )
  outerShell.name = `${config.label}OuterFresnelShell`
  outerShell.renderOrder = 10

  const innerShell = new THREE.Mesh(
    shellGeometry,
    innerShellMaterial,
  )
  innerShell.name = `${config.label}InnerFresnelShell`
  innerShell.renderOrder = 11

  shellGroup.add(outerShell)
  shellGroup.add(innerShell)

  const graphPanel = createRadialGraphPanel({
    samples,
    graphConfig: config.graphConfig,
    widthMeters: config.graphWidthMeters ?? 1.5,
    heightMeters: config.graphHeightMeters ?? 0.84,
  })

  graphPanel.mesh.position.copy(
    config.graphWorldPosition ??
      new THREE.Vector3(-1.45, contentHeight, 0),
  )
  simulationRoot.add(graphPanel.mesh)

  const initialShellOuterRadiusA0 = THREE.MathUtils.clamp(
    config.initialShellOuterRadiusA0,
    shellMinimumA0,
    shellMaximumA0,
  )

  const shellState = {
    outerRadiusA0: initialShellOuterRadiusA0,
    innerRadiusA0: Math.max(
      initialShellOuterRadiusA0 - shellThicknessA0,
      0.001,
    ),
    highlightedCount: 0,
  }

  let radialScaleControl = null
  let webShellDragStartRadiusA0 = shellState.outerRadiusA0

  const desktopGraph = createDesktopRadialGraph({
    containerId: config.desktopGraphContainerId,
    samples,
    graphConfig: config.graphConfig,
    ariaLabel: config.desktopGraphAriaLabel,
    minRadiusA0: shellMinimumA0,
    maxRadiusA0: shellMaximumA0,

    onRadiusChange(nextRadiusA0) {
      radialScaleControl?.setValue(
        nextRadiusA0,
        'desktop-graph-drag',
      )
    },
  })

  function getGraphState() {
    return {
      orbitalType: config.label,
      innerRadiusA0: shellState.innerRadiusA0,
      outerRadiusA0: shellState.outerRadiusA0,
      highlightedCount: shellState.highlightedCount,
      totalCount: samples.count,
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
      shellMinimumA0,
      shellMaximumA0,
    )

    shellState.innerRadiusA0 = Math.max(
      shellState.outerRadiusA0 - shellThicknessA0,
      0.001,
    )

    outerShell.scale.setScalar(
      shellState.outerRadiusA0 * a0ToMeters,
    )
    innerShell.scale.setScalar(
      shellState.innerRadiusA0 * a0ToMeters,
    )

    shellState.highlightedCount = pointCloud.updateHighlight(
      shellState.innerRadiusA0,
      shellState.outerRadiusA0,
    )

    updateGraphs()

    return shellState.outerRadiusA0
  }

  radialScaleControl = new RadialScaleControlSystem({
    initialValue: shellState.outerRadiusA0,
    minValue: shellMinimumA0,
    maxValue: shellMaximumA0,
    dragGain: config.shellDragGainA0PerMeter ?? 1.25,
    handPriority: ['right', 'left'],
    onChange: setShellOuterRadiusA0,
  })

  function updateGraphBillboard() {
    graphPanel.mesh.getWorldPosition(GRAPH_WORLD_POSITION)
    app.camera.getWorldPosition(CAMERA_WORLD_POSITION)

    GRAPH_LOOK_TARGET.copy(CAMERA_WORLD_POSITION)
    GRAPH_LOOK_TARGET.y = GRAPH_WORLD_POSITION.y

    graphPanel.mesh.lookAt(GRAPH_LOOK_TARGET)
  }

  setShellOuterRadiusA0(initialShellOuterRadiusA0)
  app.scene.add(group)

  const simulation = {
    id: config.id,
    name: config.id,
    label: config.label,

    xrMenuLabel: config.xrMenuLabel ?? config.label,
    xrMenuOrder: config.xrMenuOrder ?? 0,
    showInXRMenu: config.showInXRMenu ?? true,

    group,
    simulationRoot,
    contentAnchor,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(0, contentHeight, 0),
    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
      desktopGraph.setVisible(!app.renderer.xr.isPresenting)
    },

    exit() {
      group.visible = false
      graphPanel.setVisible(false)
      desktopGraph.setVisible(false)
      radialScaleControl.reset()
    },

    handleInput(interactionState, context = {}) {
      if (!context.isXR) {
        return
      }

      radialScaleControl.update(interactionState)
    },

    update(_deltaTime, context = {}) {
      const isXR = Boolean(context.isXR)

      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(!isXR)

      if (isXR) {
        updateGraphBillboard()
      }
    },

    getWebInteractionProfile() {
      return {
        idleCameraOrbit: true,

        verticalDrag: {
          onStart() {
            webShellDragStartRadiusA0 =
              shellState.outerRadiusA0
          },

          onChange({ totalDeltaY }) {
            const normalizedDelta =
              -totalDeltaY /
              (config.webShellFullRangeDragPixels ?? 260)

            const nextRadiusA0 =
              webShellDragStartRadiusA0 +
              normalizedDelta *
                (shellMaximumA0 - shellMinimumA0)

            radialScaleControl.setValue(
              nextRadiusA0,
              'web-vertical-drag',
            )
          },

          onEnd() {
            webShellDragStartRadiusA0 =
              shellState.outerRadiusA0
          },
        },
      }
    },

    getShellState() {
      return {
        ...shellState,
      }
    },

    getSamples() {
      return samples
    },

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

      nucleus.dispose()
      shellGeometry.dispose()
      outerShellMaterial.dispose()
      innerShellMaterial.dispose()
      pointCloud.dispose()
      graphPanel.dispose()
      desktopGraph.dispose()
    },
  }

  return simulation
}

function validateConfig(config) {
  const requiredFields = [
    'id',
    'label',
    'sampleGenerator',
    'sampleMaxRadiusA0',
    'shellMaxRadiusA0',
    'initialShellOuterRadiusA0',
    'pointColor',
    'highlightColor',
    'shellColor',
    'desktopGraphContainerId',
    'graphConfig',
  ]

  for (const field of requiredFields) {
    if (config?.[field] === undefined) {
      throw new Error(
        `createSOrbitalSimulationBase requires config.${field}`,
      )
    }
  }
}
