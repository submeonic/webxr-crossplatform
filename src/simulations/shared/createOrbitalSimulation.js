import * as THREE from 'three'

import { createOrbitalControls } from '../../systems/interaction/createOrbitalControls.js'
import { createActivityPanel } from '../../systems/ui/createActivityPanel.js'
import { guidedActivities } from '../shared/guidedActivities.js'

import { createFresnelShellMaterial } from '../s-orbitals/rendering/createFresnelShellMaterial.js'
import { createNucleus } from '../s-orbitals/rendering/createNucleus.js'
import { createOrbitalPointCloud } from '../s-orbitals/rendering/createOrbitalPointCloud.js'
import { createDesktopRadialGraph } from '../s-orbitals/ui/createDesktopRadialGraph.js'
import { createRadialGraphPanel } from '../s-orbitals/ui/createRadialGraphPanel.js'

const GRAPH_WORLD_POSITION = new THREE.Vector3()
const CAMERA_WORLD_POSITION = new THREE.Vector3()
const GRAPH_LOOK_TARGET = new THREE.Vector3()
const DEFAULT_PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const DEFAULT_GRAPH_POSITION = new THREE.Vector3(-2.6, 1.45, -0.15)

export function createOrbitalSimulation(app, config) {
  validateConfig(config)

  const contentHeight = config.contentHeight ?? 1.45
  const shellThicknessA0 = config.shellThicknessA0 ?? 0.15
  const shellMinimumA0 =
    config.shellMinRadiusA0 ?? shellThicknessA0
  const shellMaximumA0 = config.shellMaxRadiusA0
  const a0ToMeters = config.a0ToMeters ?? 0.25
  const simulationScale = config.simulationScale ?? 1

  const group = new THREE.Group()
  group.name = `${config.label}OrbitalSimulation`

  const simulationRoot = new THREE.Group()
  simulationRoot.name = `${config.label}OrbitalPresentationRoot`
  simulationRoot.position.copy(
    config.presentationOffset ?? DEFAULT_PRESENTATION_OFFSET,
  )
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = `${config.label}OrbitalContentAnchor`
  contentAnchor.position.set(0, contentHeight, 0)
  simulationRoot.add(contentAnchor)

  // Only the atom visualization is scaled. The graph stays a readable size.
  const orbitalRoot = new THREE.Group()
  orbitalRoot.name = `${config.label}OrbitalVisualizationRoot`
  orbitalRoot.scale.setScalar(simulationScale)
  orbitalRoot.rotation.y = config.initialYawRadians ?? 0
  contentAnchor.add(orbitalRoot)

  const samples = config.sampleGenerator({
    count: config.electronCount ?? 1000,
    seed: config.seed,
    maxRadiusA0: config.sampleMaxRadiusA0,
    a0ToMeters,
  })

  const pointCloud = createOrbitalPointCloud({
    samples,
    electronRadius: config.electronRadiusMeters ?? 0.03,
    baseColor: config.pointColor,
    baseOpacity: config.pointOpacity ?? 0.16,
    highlightColor: config.highlightColor,
    highlightOpacity: config.highlightOpacity ?? 0.98,
  })
  orbitalRoot.add(pointCloud.group)

  const nucleus = createNucleus({
    radiusMeters: config.nucleusRadiusMeters ?? 0.05,
  })
  orbitalRoot.add(nucleus.mesh)

  const shellGroup = new THREE.Group()
  shellGroup.name = `${config.label}ConstantThicknessFresnelShell`
  orbitalRoot.add(shellGroup)

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

  shellGroup.add(outerShell, innerShell)

  const graphPanel = createRadialGraphPanel({
    samples,
    graphConfig: config.graphConfig,
    widthMeters: config.graphWidthMeters ?? 1.8,
    heightMeters: config.graphHeightMeters ?? 1.008,
  })
  graphPanel.mesh.position.copy(
    config.graphWorldPosition ?? DEFAULT_GRAPH_POSITION,
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

  let orbitalLabel = config.label

  function getGraphState() {
    return {
      orbitalType: orbitalLabel,
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

  const controls = createOrbitalControls({
    app, target: orbitalRoot,
    getRadius: () => shellState.outerRadiusA0,
    setRadius: setShellOuterRadiusA0,
    minRadius: shellMinimumA0,
    maxRadius: shellMaximumA0,
    settings: {
      xrShellFullRangeMeters: config.xrFullRangeDragDistanceMeters ?? 0.18,
      webShellFullRangePixels: config.webShellFullRangeDragPixels ?? 260,
      ...config.controls,
    },
  })
  const activity = config.activity ?? guidedActivities[config.id]
  const activityPanel = activity ? createActivityPanel(activity, config.activityPanel) : null
  if (activityPanel) {
    activityPanel.mesh.position.copy(config.activityPosition ?? new THREE.Vector3(2.6, contentHeight, -0.15))
    simulationRoot.add(activityPanel.mesh)
  }

  const desktopGraph = createDesktopRadialGraph({
    containerId: config.desktopGraphContainerId,
    samples,
    graphConfig: config.graphConfig,
    ariaLabel: config.desktopGraphAriaLabel,
    minRadiusA0: shellMinimumA0,
    maxRadiusA0: shellMaximumA0,
    onRadiusChange(nextRadiusA0) {
      setShellOuterRadiusA0(nextRadiusA0)
    },
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

  return {
    id: config.id,
    name: config.id,
    label: config.label,

    xrMenuLabel: config.xrMenuLabel ?? config.label,
    xrMenuOrder: config.xrMenuOrder ?? 0,
    showInXRMenu: config.showInXRMenu ?? true,

    group,
    simulationRoot,
    contentAnchor,
    orbitalRoot,
    pointCloudRoot: pointCloud.group,
    settings: config,
    idleCameraOrbit: false,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(0, contentHeight, 0),
    webInitialCameraDistance: config.webInitialCameraDistance ?? 5.5,
    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
      desktopGraph.setVisible(true)
    },

    exit() {
      group.visible = false
      graphPanel.setVisible(false)
      desktopGraph.setVisible(true)
      controls.xr.reset('simulation-exit')
      if (activityPanel) activityPanel.mesh.visible = false
    },

    handleInput(interactionState, context = {}) {
      if (!context.isXR) return
      controls.xr.update(interactionState, context.deltaTime)
    },

    isXRInteractionActive() {
      return controls.xr.isActive()
    },

    resetXRInteraction(reason = 'simulation-reset') {
      controls.xr.reset(reason)
    },

    update(_deltaTime, context = {}) {
      const isXR = Boolean(context.isXR)

      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(true)

      if (isXR) updateGraphBillboard()
      activityPanel?.update(isXR, app.camera)
    },

    getWebInteractionProfile() { return controls.web },

    setOrbitalLabel(label) {
      orbitalLabel = label
      const dataset = config.graphConfig.datasets.find(d => d.id === config.graphConfig.activeDatasetId)
      if (dataset) dataset.label = label
      updateGraphs()
    },

    getShellState() {
      return { ...shellState }
    },

    getSamples() {
      return samples
    },

    getRadialScaleControlState() {
      return { ...controls.xr.getState(), currentValue: shellState.outerRadiusA0 }
    },

    setShellOuterRadiusA0(nextOuterRadiusA0) {
      return setShellOuterRadiusA0(nextOuterRadiusA0)
    },

    dispose() {
      controls.xr.reset('simulation-dispose')
      activityPanel?.dispose()
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
        `createOrbitalSimulation requires config.${field}`,
      )
    }
  }
}
