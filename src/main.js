import './style.css'

import { createWebXRApp } from './core/createWebXRApp.js'
import { ScrollSimulationController } from './core/ScrollSimulationController.js'

import { createIntroSphereSimulation } from './simulations/introSphere.js'
import { createShellRegionSimulation } from './simulations/shellRegion.js'
import { createOrbitalViewSimulation } from './simulations/orbitalView.js'

/* ====================================================
   FADE-IN SCROLL ANIMATIONS

   This is page/UI behavior, so it can stay in main.js.
   Simulation switching now lives in ScrollSimulationController.
==================================================== */

function initializeFadeInAnimations() {
  const elements = document.querySelectorAll('.fade-scroll')

  const check = () => {
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight * 0.88) {
        element.classList.add('visible')
      }
    })
  }

  window.addEventListener('scroll', check)
  window.addEventListener('resize', check)

  check()
}

initializeFadeInAnimations()

/* ====================================================
   WEBXR APP SETUP
==================================================== */

const canvasContainer = document.getElementById('xr-canvas-container')
const xrButtonContainer = document.getElementById('xr-button-container')

const app = createWebXRApp({
  container: canvasContainer,
  xrButtonContainer,
  showHandModels: true,
  showXRDebugPanel: false,
  showHandDebugJoints: false,
  showHandDebugAxes: false,
})

/* ====================================================
   SIMULATION REGISTRY
==================================================== */

const simulations = {
  intro: createIntroSphereSimulation(app),
  shell: createShellRegionSimulation(app),
  orbital: createOrbitalViewSimulation(app),
}

for (const simulation of Object.values(simulations)) {
  simulation.exit()
}

/* ====================================================
   SCROLL-BASED SIMULATION SWITCHING
==================================================== */

const scrollSimulationController = new ScrollSimulationController({
  app,
  simulations,
  sectionSelector: '[data-simulation]',
  initialSimulationName: 'intro',
  logChanges: true,
})

scrollSimulationController.start()

/* ====================================================
   START
==================================================== */

app.start()