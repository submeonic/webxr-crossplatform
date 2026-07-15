import './style.css'

import { createWebXRApp } from './core/createWebXRApp.js'
import { ResponsiveViewerPlacementController } from './systems/navigation/ResponsiveViewerPlacementController.js'
import { ScrollSimulationController } from './systems/navigation/ScrollSimulationController.js'

import { create1SOrbitalSimulation } from './simulations/s-orbitals/create1SOrbitalSimulation.js'
import { create2SOrbitalSimulation } from './simulations/s-orbitals/create2SOrbitalSimulation.js'
import { createPOrbitalSimulation } from './simulations/p-orbitals/createPOrbitalSimulation.js'

function initializeFadeInAnimations() {
  const elements = document.querySelectorAll('.fade-scroll')

  const check = () => {
    elements.forEach((element) => {
      if (
        element.getBoundingClientRect().top <
        window.innerHeight * 0.88
      ) {
        element.classList.add('visible')
      }
    })
  }

  window.addEventListener('scroll', check)
  window.addEventListener('resize', check)

  check()
}

initializeFadeInAnimations()

const canvasContainer = document.getElementById(
  'xr-canvas-container',
)
const xrButtonContainer = document.getElementById(
  'xr-button-container',
)
const viewerElement = document.querySelector(
  '[data-simulation-viewer]',
)
const viewerStatus = document.querySelector('.viewer-status')
const desktopViewerSlot = document.querySelector(
  '[data-desktop-viewer-slot]',
)

const app = createWebXRApp({
  container: canvasContainer,
  xrButtonContainer,
  viewerStatus,
  showHandModels: true,
  showXRDebugPanel: false,
  showHandDebugJoints: false,
  showHandDebugAxes: false,

  webDragActivationPixels: 8,
  webOrbitRadiansPerPixel: 0.006,
  webPinchDollyDistancePerPixel: 0.01,
  webWheelDollyDistancePerPixel: 0.0025,

  desktopMinDistance: 0.5,
  desktopMaxDistance: 14,
  desktopDefaultDistance: 2.65,

  pinchDragIndicatorColor: 0xfff7ae,
  pinchDragMarkerRadius: 0.012,
  pinchDragLineLength: 0.11,
  pinchDragMaximumVisualDisplacement: 0.16,

  desktopIdleOrbitEnabled: true,
  desktopIdleOrbitDegreesPerSecond: 5,
  desktopIdleOrbitDelaySeconds: 2,
})

const simulations = {
  '1s-orbital': create1SOrbitalSimulation(app),
  '2s-orbital': create2SOrbitalSimulation(app),
  '2p-orbital': createPOrbitalSimulation(app),
}

// The future 2p interaction will manipulate its simulation root directly.
// Keep both camera and object presentation completely still until then.
simulations['2p-orbital'].idleCameraOrbit = false

for (const simulation of Object.values(simulations)) {
  simulation.exit()
}

const viewerPlacementController =
  new ResponsiveViewerPlacementController({
    viewerElement,
    desktopSlot: desktopViewerSlot,
    mobileMediaQuery: '(max-width: 760px)',
    isXRPresenting: () => app.renderer.xr.isPresenting,
    onPlacementChanged: () => {
      app.resize()
    },
  })

viewerPlacementController.start()

const scrollSimulationController =
  new ScrollSimulationController({
    app,
    simulations,
    sectionSelector: '[data-simulation]',
    initialSimulationName: '1s-orbital',
    logChanges: true,

    onSimulationChange: ({ simulationName }) => {
      viewerPlacementController.setActiveSimulation(
        simulationName,
      )
    },
  })

app.renderer.xr.addEventListener('sessionend', () => {
  viewerPlacementController.refreshPlacement()
  app.resize()
})

scrollSimulationController.start()
app.start()
