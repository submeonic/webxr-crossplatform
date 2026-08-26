import * as THREE from 'three'

import { ObjectRotationControlSystem } from '../../systems/interaction/ObjectRotationControlSystem.js'
import {
  generate2pxSamples,
  radialProbability2p,
} from './data/pOrbitalSamplers.js'

import {
  radialProbability1s,
  radialProbability2s,
} from '../s-orbitals/data/sOrbitalDistributions.js'
import { createNucleus } from '../s-orbitals/rendering/createNucleus.js'
import { createOrbitalPointCloud } from '../s-orbitals/rendering/createOrbitalPointCloud.js'
import { createDesktopRadialGraph } from '../s-orbitals/ui/createDesktopRadialGraph.js'
import { createRadialGraphPanel } from '../s-orbitals/ui/createRadialGraphPanel.js'

const PRESENTATION_OFFSET = new THREE.Vector3(0, 0, -2)
const CONTENT_HEIGHT = 1.45

/*
 * Match the current 1s / 2s visual scale exactly.
 */
const ORBITAL_SCALE = 0.6
const WEB_INITIAL_CAMERA_DISTANCE = 2.5

const ELECTRON_COUNT = 1000
const SAMPLE_MAX_RADIUS_A0 = 12
const A0_TO_METERS = 0.25

const POINT_COLOR = 0xeadfad
const POINT_OPACITY = 0.16
const ELECTRON_RADIUS_METERS = 0.035
const NUCLEUS_RADIUS_METERS = 0.1

/*
 * Graph styling follows the existing 1s / 2s radial graph implementation.
 * The 2p color matches the pink used by the reference LearnQM chart.
 */
const YELLOW = '#fff7ae'
const GREEN = '#6ecf7f'
const PINK = '#ea9fa2'
const SHARED_GRAPH_Y_MAX = radialProbability1s(1)

const GRAPH_WORLD_POSITION = new THREE.Vector3(
  -1.75,
  CONTENT_HEIGHT,
  -0.15,
)
const GRAPH_WORLD_POSITION_TEMP = new THREE.Vector3()
const CAMERA_WORLD_POSITION = new THREE.Vector3()
const GRAPH_LOOK_TARGET = new THREE.Vector3()

/*
 * Rotation tuning.
 *
 * Horizontal desktop/touch drag -> world Y.
 * Vertical desktop/touch drag   -> world X.
 * XR pinch movement uses the same fixed world axes.
 */
const WEB_YAW_RADIANS_PER_PIXEL = 0.008
const WEB_PITCH_RADIANS_PER_PIXEL = 0.008

const XR_YAW_RADIANS_PER_METER = 7.0
const XR_PITCH_RADIANS_PER_METER = 7.0

const SNAP_SPEED = 10

function createOrientationLabel(initialLabel = '2px') {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160

  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  })

  const sprite = new THREE.Sprite(material)
  sprite.name = 'POrbitalOrientationLabel'
  sprite.position.set(0, 1.18, 0)
  sprite.scale.set(0.58, 0.18, 1)

  let currentLabel = null

  function draw(label) {
    if (label === currentLabel) return
    currentLabel = label

    context.clearRect(0, 0, canvas.width, canvas.height)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font =
      '700 92px "Bai Jamjuree", Arial, Helvetica, sans-serif'
    context.fillStyle = YELLOW

    context.fillText(
      label,
      canvas.width * 0.5,
      canvas.height * 0.5,
    )

    texture.needsUpdate = true
  }

  draw(initialLabel)

  return {
    sprite,
    setLabel: draw,
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}

export function createPOrbitalSimulation(app) {
  const group = new THREE.Group()
  group.name = 'POrbitalSimulation'

  const simulationRoot = new THREE.Group()
  simulationRoot.name = 'POrbitalPresentationRoot'
  simulationRoot.position.copy(PRESENTATION_OFFSET)
  group.add(simulationRoot)

  const contentAnchor = new THREE.Object3D()
  contentAnchor.name = 'POrbitalContentAnchor'
  contentAnchor.position.set(0, CONTENT_HEIGHT, 0)
  simulationRoot.add(contentAnchor)

  /*
   * Keep presentation placement separate from user rotation.
   * Only this child is manipulated by the p-orbital interaction.
   */
  const orbitalRotationRoot = new THREE.Group()
  orbitalRotationRoot.name = 'POrbitalRotationRoot'
  orbitalRotationRoot.scale.setScalar(ORBITAL_SCALE)
  contentAnchor.add(orbitalRotationRoot)

  const samples = generate2pxSamples({
    count: ELECTRON_COUNT,
    rMaxA0: SAMPLE_MAX_RADIUS_A0,
    a0ToMeters: A0_TO_METERS,
    seed: 2202,
  })

  const pointCloud = createOrbitalPointCloud({
    samples,
    electronRadius: ELECTRON_RADIUS_METERS,
    baseColor: POINT_COLOR,
    baseOpacity: POINT_OPACITY,
    highlightColor: 0xfff7ae,
    highlightOpacity: 0.98,
  })

  orbitalRotationRoot.add(pointCloud.group)

  const nucleus = createNucleus({
    radiusMeters: NUCLEUS_RADIUS_METERS,
  })
  orbitalRotationRoot.add(nucleus.mesh)

  /*
   * Keep the title outside the rotatable root so it stays upright/readable.
   */
  const orientationLabel = createOrientationLabel('2px')
  contentAnchor.add(orientationLabel.sprite)

  /*
   * One radial distribution is shared by 2px, 2py, and 2pz. Rotation changes
   * the angular orientation of the cloud, not probability versus radius.
   *
   * We deliberately reuse the existing graph renderer:
   *   1s = faint yellow comparison
   *   2s = faint green comparison
   *   2p = active pink bars
   */
  const pDataset = {
    id: '2p',
    label: '2px',
    role: 'primary',
    renderStyle: 'bars',
    color: PINK,
    opacity: 1,
    lineWidth: 1,
    getValue: radialProbability2p,
  }

  const graphConfig = {
    xMinA0: 0,
    xMaxA0: 12,
    yMin: 0,
    yMax: SHARED_GRAPH_Y_MAX,
    activeDatasetId: '2p',
    datasets: [
      {
        id: '1s',
        label: '1s',
        role: 'comparison',
        renderStyle: 'points',
        color: YELLOW,
        opacity: 0.16,
        pointRadius: 2,
        getValue: radialProbability1s,
      },
      {
        id: '2s',
        label: '2s',
        role: 'comparison',
        renderStyle: 'points',
        color: GREEN,
        opacity: 0.34,
        pointRadius: 2,
        getValue: radialProbability2s,
      },
      pDataset,
    ],
  }

  const graphPanel = createRadialGraphPanel({
    samples,
    graphConfig,
    widthMeters: 1.5,
    heightMeters: 0.84,
  })
  graphPanel.mesh.position.copy(GRAPH_WORLD_POSITION)
  simulationRoot.add(graphPanel.mesh)

  const desktopGraph = createDesktopRadialGraph({
    containerId: '2p-orbital-desktop-graph',
    samples,
    graphConfig,
    ariaLabel:
      '2p orbital radial probability graph with 1s and 2s comparisons',
    minRadiusA0: 0,
    maxRadiusA0: 12,
    onRadiusChange: null,
  })

  let currentOrientationLabel = '2px'

  function getGraphState() {
    return {
      orbitalType: currentOrientationLabel,
      innerRadiusA0: 0,
      outerRadiusA0: 0,
      highlightedCount: 0,
      totalCount: samples.count,
    }
  }

  function updateGraphs() {
    const graphState = getGraphState()
    graphPanel.update(graphState)
    desktopGraph.update(graphState)
  }

  function updateGraphBillboard() {
    graphPanel.mesh.getWorldPosition(
      GRAPH_WORLD_POSITION_TEMP,
    )
    app.camera.getWorldPosition(
      CAMERA_WORLD_POSITION,
    )

    /*
     * Match the s-orbital panels: yaw toward the viewer while keeping the
     * graph vertically upright in world space.
     */
    GRAPH_LOOK_TARGET.copy(CAMERA_WORLD_POSITION)
    GRAPH_LOOK_TARGET.y = GRAPH_WORLD_POSITION_TEMP.y
    graphPanel.mesh.lookAt(GRAPH_LOOK_TARGET)
  }

  const rotationControl =
    new ObjectRotationControlSystem({
      target: orbitalRotationRoot,

      // Samples start in canonical 2px, so local X is the lobe axis.
      localPrimaryAxis: new THREE.Vector3(1, 0, 0),

      webYawRadiansPerPixel:
        WEB_YAW_RADIANS_PER_PIXEL,
      webPitchRadiansPerPixel:
        WEB_PITCH_RADIANS_PER_PIXEL,

      xrYawRadiansPerMeter:
        XR_YAW_RADIANS_PER_METER,
      xrPitchRadiansPerMeter:
        XR_PITCH_RADIANS_PER_METER,

      snapSpeed: SNAP_SPEED,
      handPriority: ['right', 'left'],

      onOrientationChange({ label }) {
        currentOrientationLabel = label
        orientationLabel.setLabel(label)

        /*
         * The radial curve itself does not change, but updating the legend label
         * reinforces that 2px, 2py, and 2pz share the same radial distribution.
         */
        pDataset.label = label
        updateGraphs()
      },
    })

  updateGraphs()
  app.scene.add(group)

  return {
    id: '2p-orbital',
    name: '2p-orbital',
    label: '2p',
    xrMenuLabel: '2p',
    xrMenuOrder: 3,
    showInXRMenu: true,

    group,
    simulationRoot,
    contentAnchor,
    orbitalRoot: orbitalRotationRoot,
    orbitalRotationRoot,

    desktopOrbitTarget: simulationRoot,
    desktopOrbitOffset: new THREE.Vector3(
      0,
      CONTENT_HEIGHT,
      0,
    ),
    webInitialCameraDistance:
      WEB_INITIAL_CAMERA_DISTANCE,
    orbitTarget: contentAnchor,

    idleCameraOrbit: false,

    enter() {
      group.visible = true

      const isXR = app.renderer.xr.isPresenting
      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(!isXR)
    },

    exit() {
      group.visible = false
      graphPanel.setVisible(false)
      desktopGraph.setVisible(false)

      // Never leave the hidden orbital between named orientations.
      rotationControl.reset(
        'simulation-exit',
        { immediate: true },
      )
    },

    handleInput(
      interactionState,
      context = {},
    ) {
      if (!context.isXR) return
      rotationControl.updateXR(interactionState)
    },

    isXRInteractionActive() {
      return rotationControl.isXRActive()
    },

    resetXRInteraction(
      reason = 'simulation-reset',
    ) {
      rotationControl.reset(reason)
    },

    update(deltaTime, context = {}) {
      rotationControl.update(deltaTime)

      const isXR = Boolean(context.isXR)
      graphPanel.setVisible(isXR)
      desktopGraph.setVisible(!isXR)

      if (isXR) {
        updateGraphBillboard()
      }
    },

    getWebInteractionProfile() {
      return {
        idleCameraOrbit: false,

        horizontalDrag: {
          onStart() {
            rotationControl.begin(
              'web-horizontal',
            )
          },

          onChange({ deltaX }) {
            rotationControl.applyWebHorizontalDelta(
              deltaX,
            )
          },

          onEnd({ cancelled }) {
            rotationControl.end(
              cancelled
                ? 'web-horizontal-cancelled'
                : 'web-horizontal-release',
            )
          },
        },

        verticalDrag: {
          onStart() {
            rotationControl.begin(
              'web-vertical',
            )
          },

          onChange({ deltaY }) {
            rotationControl.applyWebVerticalDelta(
              deltaY,
            )
          },

          onEnd({ cancelled }) {
            rotationControl.end(
              cancelled
                ? 'web-vertical-cancelled'
                : 'web-vertical-release',
            )
          },
        },
      }
    },

    getOrientationState() {
      return rotationControl.getState()
    },

    getSamples() {
      return samples
    },

    dispose() {
      rotationControl.reset(
        'simulation-dispose',
        { immediate: true },
      )

      app.scene.remove(group)

      orientationLabel.dispose()
      nucleus.dispose()
      pointCloud.dispose()
      graphPanel.dispose()
      desktopGraph.dispose()
    },
  }
}
