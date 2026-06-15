import './style.css'

import { createWebXRApp } from './core/createWebXRApp.js'

import { createIntroSphereSimulation } from './simulations/introSphere.js'
import { createShellRegionSimulation } from './simulations/shellRegion.js'
import { createOrbitalViewSimulation } from './simulations/orbitalView.js'

/*
====================================================
FADE-IN SCROLL ANIMATIONS
====================================================
*/

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

/*
====================================================
WEBXR APP SETUP
====================================================
*/

const canvasContainer =
  document.getElementById('xr-canvas-container')

const xrButtonContainer =
  document.getElementById('xr-button-container')

const app = createWebXRApp({
  container: canvasContainer,
  xrButtonContainer,

  showHandModels: true,

  showXRDebugPanel: false,
  showHandDebugJoints: true,
  showHandDebugAxes: true
})

/*
====================================================
SIMULATION REGISTRY
====================================================
*/

const simulations = {
  intro: createIntroSphereSimulation(app),
  shell: createShellRegionSimulation(app),
  orbital: createOrbitalViewSimulation(app)
}

for (const simulation of Object.values(simulations)) {
  simulation.exit()
}

let activeSimulationName = 'intro'

app.setActiveSimulation(simulations[activeSimulationName])

/*
====================================================
SCROLL-BASED SIMULATION SWITCHING
====================================================
*/

const sections =
  Array.from(document.querySelectorAll('[data-simulation]'))

function setSimulationFromName(simulationName) {
  if (!simulationName) return
  if (simulationName === activeSimulationName) return

  const simulation = simulations[simulationName]

  if (!simulation) {
    console.warn(`No simulation registered for "${simulationName}"`)
    return
  }

  activeSimulationName = simulationName
  app.setActiveSimulation(simulation)

  console.log(`Active simulation: ${simulationName}`)
}

function getClosestSectionToViewportCenter() {
  const viewportCenterY = window.innerHeight * 0.5

  let closestSection = null
  let closestDistance = Infinity

  for (const section of sections) {
    const rect = section.getBoundingClientRect()

    /*
    Ignore sections that are completely outside the viewport.
    */
    const isVisible =
      rect.bottom > 0 &&
      rect.top < window.innerHeight

    if (!isVisible) continue

    const sectionCenterY =
      rect.top + rect.height * 0.5

    const distance =
      Math.abs(sectionCenterY - viewportCenterY)

    if (distance < closestDistance) {
      closestDistance = distance
      closestSection = section
    }
  }

  return closestSection
}

let scrollSwitchQueued = false

function updateSimulationFromScroll() {
  scrollSwitchQueued = false

  /*
  Do not let webpage scroll change the active simulation
  while the user is inside XR.
  */
  if (app.renderer.xr.isPresenting) return

  const closestSection =
    getClosestSectionToViewportCenter()

  if (!closestSection) return

  const simulationName =
    closestSection.dataset.simulation

  setSimulationFromName(simulationName)
}

function queueScrollSimulationUpdate() {
  if (scrollSwitchQueued) return

  scrollSwitchQueued = true
  requestAnimationFrame(updateSimulationFromScroll)
}

window.addEventListener('scroll', queueScrollSimulationUpdate)
window.addEventListener('resize', queueScrollSimulationUpdate)

/*
Run once after layout has settled.
*/
queueScrollSimulationUpdate()

/*
====================================================
START
====================================================
*/

app.start()