import * as THREE from 'three'

import { createOrbitalControls } from '../../systems/interaction/createOrbitalControls.js'
import { createActivityPanel } from '../../systems/ui/createActivityPanel.js'
import { guidedActivities } from '../shared/guidedActivities.js'

import { createFresnelShellMaterial } from '../s-orbitals/rendering/createFresnelShellMaterial.js'
import { createNucleus } from '../s-orbitals/rendering/createNucleus.js'
import { createOrbitalPointCloud } from '../s-orbitals/rendering/createOrbitalPointCloud.js'
import { createDesktopRadialGraph } from '../s-orbitals/ui/createDesktopRadialGraph.js'
import { createRadialGraphPanel } from '../s-orbitals/ui/createRadialGraphPanel.js'
import { createProbabilityRegion } from './rendering/createProbabilityRegion.js'

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

  let samples = config.sampleGenerator({
    count: config.electronCount ?? 1000,
    seed: config.seed,
    maxRadiusA0: config.sampleMaxRadiusA0,
    a0ToMeters,
  })

  const distributionRoot = new THREE.Group()
  distributionRoot.name = `${config.label}OrbitalDistributionRoot`
  orbitalRoot.add(distributionRoot)

  const pointCloud = createOrbitalPointCloud({
    samples,
    electronRadius: config.electronRadiusMeters ?? 0.03,
    baseColor: config.pointColor,
    baseOpacity: config.pointOpacity ?? 0.16,
    highlightColor: config.highlightColor,
    highlightOpacity: config.highlightOpacity ?? 0.98,
  })
  distributionRoot.add(pointCloud.group)

  const probabilityRegion = createProbabilityRegion({
    orbitalType: config.regionOrbitalType ?? config.id,
    a0ToMeters,
    enclosedProbability: config.regionProbability ?? 0.9,
    color: config.regionColor ?? config.highlightColor,
    rimColor: config.regionRimColor ?? config.shellColor,
    baseAlpha: config.regionBaseAlpha ?? 0.07,
    rimAlpha: config.regionRimAlpha ?? 0.42,
    fresnelPower: config.regionFresnelPower ?? 2.2,
  })
  distributionRoot.add(probabilityRegion.group)

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
  let viewMode = 'measurements'
  let currentSeed = config.seed >>> 0

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
  const xrIdleRotationDelaySeconds = config.xrIdleRotationDelaySeconds ?? 3
  const xrIdleRotationRadiansPerSecond = config.xrIdleRotationRadiansPerSecond ??
    THREE.MathUtils.degToRad(3)
  let xrIdleElapsedSeconds = 0
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

  const webControls = createWebControls()

  function createWebControls() {
    const element = document.createElement('div')
    element.className = 'orbital-selector orbital-controls'
    element.setAttribute('role', 'group')
    element.setAttribute('aria-label', `${config.label} orbital controls`)
    element.hidden = true

    const viewActionsGroup = document.createElement('div')
    viewActionsGroup.className = 'orbital-control-group orbital-control-group--view'
    viewActionsGroup.setAttribute('role', 'group')
    viewActionsGroup.setAttribute('aria-label', 'Probability display and sampling')

    const viewModeButton = document.createElement('button')
    viewModeButton.type = 'button'
    viewModeButton.className = 'orbital-region-switch'
    viewModeButton.textContent = 'REGION'
    viewModeButton.setAttribute('role', 'switch')
    viewModeButton.addEventListener('click', toggleViewMode)

    const resampleButton = document.createElement('button')
    resampleButton.type = 'button'
    resampleButton.textContent = 'RESAMPLE'
    resampleButton.setAttribute(
      'aria-label',
      'Generate a new set of orbital measurements',
    )
    resampleButton.addEventListener('click', () => {
      resampleMeasurements()
    })

    viewActionsGroup.append(viewModeButton, resampleButton)
    element.append(viewActionsGroup)
    document.querySelector('[data-simulation-viewer]')?.append(element)

    return { element, viewActionsGroup, viewModeButton, resampleButton }
  }

  function updateWebControls() {
    const isRegion = viewMode === 'region'
    webControls.viewModeButton.setAttribute(
      'aria-checked',
      String(isRegion),
    )
    webControls.viewModeButton.setAttribute(
      'aria-label',
      isRegion
        ? 'Hide the 90% probability region overlay'
        : 'Show the 90% probability region overlay',
    )
  }

  function refreshContextActions() {
    if (group.visible) {
      app.palmNavigationSystem?.refreshContextActions?.()
    }
  }

  function setViewMode(nextMode) {
    if (nextMode !== 'measurements' && nextMode !== 'region') return false
    if (viewMode === nextMode) return true

    viewMode = nextMode
    const isRegion = viewMode === 'region'
    pointCloud.group.visible = true
    shellGroup.visible = true
    probabilityRegion.group.visible = isRegion
    updateWebControls()
    refreshContextActions()
    return true
  }

  function toggleViewMode() {
    return setViewMode(
      viewMode === 'measurements' ? 'region' : 'measurements',
    )
  }

  function resampleMeasurements(seed = createRandomSeed()) {
    const nextSeed = seed >>> 0
    const nextSamples = config.sampleGenerator({
      count: config.electronCount ?? 1000,
      seed: nextSeed,
      maxRadiusA0: config.sampleMaxRadiusA0,
      a0ToMeters,
    })

    pointCloud.setSamples(nextSamples)
    samples = nextSamples
    currentSeed = nextSeed
    setShellOuterRadiusA0(shellState.outerRadiusA0)
    return currentSeed
  }

  updateWebControls()

  function updateGraphBillboard() {
    graphPanel.mesh.getWorldPosition(GRAPH_WORLD_POSITION)
    app.camera.getWorldPosition(CAMERA_WORLD_POSITION)

    GRAPH_LOOK_TARGET.copy(CAMERA_WORLD_POSITION)
    GRAPH_LOOK_TARGET.y = GRAPH_WORLD_POSITION.y
    graphPanel.mesh.lookAt(GRAPH_LOOK_TARGET)
  }

  setShellOuterRadiusA0(initialShellOuterRadiusA0)
  app.scene.add(group)

  const result = {
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
    distributionRoot,
    pointCloudRoot: pointCloud.group,
    probabilityRegionRoot: probabilityRegion.group,
    webControlsElement: webControls.element,
    webViewActionsGroup: webControls.viewActionsGroup,
    webViewModeButton: webControls.viewModeButton,
    webResampleButton: webControls.resampleButton,
    settings: config,
    idleCameraOrbit: true,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(0, contentHeight, 0),
    webInitialCameraDistance: config.webInitialCameraDistance ?? 5.5,
    orbitTarget: contentAnchor,

    enter() {
      group.visible = true
      desktopGraph.setVisible(true)
      webControls.element.hidden = app.renderer.xr.isPresenting
      xrIdleElapsedSeconds = 0
    },

    exit() {
      group.visible = false
      graphPanel.setVisible(false)
      desktopGraph.setVisible(true)
      webControls.element.hidden = true
      controls.xr.reset('simulation-exit')
      xrIdleElapsedSeconds = 0
      if (activityPanel) activityPanel.mesh.visible = false
    },

    handleInput(interactionState, context = {}) {
      if (!context.isXR) return
      controls.xr.update(interactionState, context.deltaTime)
      if (controls.xr.isActive()) xrIdleElapsedSeconds = 0
    },

    isXRInteractionActive() {
      return controls.xr.isActive()
    },

    resetXRInteraction(reason = 'simulation-reset') {
      controls.xr.reset(reason)
    },

    update(deltaTime, context = {}) {
      const isXR = Boolean(context.isXR)

      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(true)
      webControls.element.hidden = isXR

      if (isXR) {
        if (controls.xr.isActive()) {
          xrIdleElapsedSeconds = 0
        } else {
          xrIdleElapsedSeconds += Math.max(0, deltaTime)
          if (xrIdleElapsedSeconds >= xrIdleRotationDelaySeconds) {
            orbitalRoot.rotation.y += xrIdleRotationRadiansPerSecond * deltaTime
          }
        }
        updateGraphBillboard()
      } else {
        xrIdleElapsedSeconds = 0
      }
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

    getViewMode() {
      return viewMode
    },

    setViewMode(nextMode) {
      return setViewMode(nextMode)
    },

    toggleViewMode() {
      return toggleViewMode()
    },

    getMeasurementSeed() {
      return currentSeed
    },

    resampleMeasurements(seed) {
      return resampleMeasurements(seed)
    },

    getProbabilityRegionDefinition() {
      return probabilityRegion.definition
    },

    getMenuActions() {
      return [
        {
          id: 'orbital-view-mode',
          label: 'REGION',
          kind: 'action',
          group: 'view',
          active: viewMode === 'region',
          onSelect: toggleViewMode,
        },
        {
          id: 'resample-measurements',
          label: 'RESAMPLE',
          kind: 'action',
          group: 'view',
          onSelect: () => resampleMeasurements(),
        },
      ]
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
      webControls.element.remove()

      nucleus.dispose()
      shellGeometry.dispose()
      outerShellMaterial.dispose()
      innerShellMaterial.dispose()
      pointCloud.dispose()
      probabilityRegion.dispose()
      graphPanel.dispose()
      desktopGraph.dispose()
    },
  }

  return result
}

function createRandomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1)
    globalThis.crypto.getRandomValues(values)
    return values[0]
  }

  return Math.floor(Math.random() * 0x100000000)
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
