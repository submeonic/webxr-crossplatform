import './style.css'

import { createWebXRApp } from './core/createWebXRApp.js'
import { ResponsiveViewerPlacementController } from './systems/navigation/ResponsiveViewerPlacementController.js'
import { ScrollSimulationController } from './systems/navigation/ScrollSimulationController.js'

import { createIntroSphereSimulation } from './simulations/intro-sphere/createIntroSphereSimulation.js'
import { createSOrbitalSimulation } from './simulations/s-orbitals/createSOrbitalSimulation.js'
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

const viewerStatus = document.querySelector(
  '.viewer-status',
)

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

  // Idle camera presentation behavior. Negative speed reverses direction.
  desktopIdleOrbitEnabled: true,
  desktopIdleOrbitDegreesPerSecond: 3,
  desktopIdleOrbitDelaySeconds: 7,
})

const simulations = {
  'intro-sphere': createIntroSphereSimulation(app),
  's-orbitals': createSOrbitalSimulation(app),
  'p-orbitals': createPOrbitalSimulation(app),
}

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
    initialSimulationName: 'intro-sphere',
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
