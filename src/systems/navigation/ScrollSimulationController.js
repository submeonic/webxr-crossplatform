export class ScrollSimulationController {
  constructor(options = {}) {
    this.app = options.app
    this.simulations = options.simulations ?? {}
    this.sectionSelector = options.sectionSelector ?? '[data-simulation]'
    this.initialSimulationName = options.initialSimulationName ?? null
    this.logChanges = options.logChanges ?? false

    if (!this.app) {
      throw new Error('ScrollSimulationController requires options.app')
    }

    this.sections = []
    this.activeSimulationName = null
    this.scrollSwitchQueued = false
    this.started = false

    this.queueUpdate = this.queueUpdate.bind(this)
    this.updateFromScroll = this.updateFromScroll.bind(this)
  }

  start() {
    if (this.started) return

    this.started = true
    this.sections = Array.from(document.querySelectorAll(this.sectionSelector))

    if (this.initialSimulationName) {
      this.setSimulationFromName(this.initialSimulationName)
    }

    window.addEventListener('scroll', this.queueUpdate)
    window.addEventListener('resize', this.queueUpdate)

    this.queueUpdate()
  }

  stop() {
    if (!this.started) return

    this.started = false

    window.removeEventListener('scroll', this.queueUpdate)
    window.removeEventListener('resize', this.queueUpdate)

    this.scrollSwitchQueued = false
  }

  refreshSections() {
    this.sections = Array.from(document.querySelectorAll(this.sectionSelector))
    this.queueUpdate()
  }

  setSimulationFromName(simulationName) {
    if (!simulationName) return
    if (simulationName === this.activeSimulationName) return

    const simulation = this.simulations[simulationName]

    if (!simulation) {
      console.warn(`No simulation registered for "${simulationName}"`)
      return
    }

    this.activeSimulationName = simulationName
    this.app.setActiveSimulation(simulation)

    if (this.logChanges) {
      console.log(`Active simulation: ${simulationName}`)
    }
  }

  getClosestSectionToViewportCenter() {
    const viewportCenterY = window.innerHeight * 0.5

    let closestSection = null
    let closestDistance = Infinity

    for (const section of this.sections) {
      const rect = section.getBoundingClientRect()

      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight
      if (!isVisible) continue

      const sectionCenterY = rect.top + rect.height * 0.5
      const distance = Math.abs(sectionCenterY - viewportCenterY)

      if (distance < closestDistance) {
        closestDistance = distance
        closestSection = section
      }
    }

    return closestSection
  }

  queueUpdate() {
    if (this.scrollSwitchQueued) return

    this.scrollSwitchQueued = true
    requestAnimationFrame(this.updateFromScroll)
  }

  updateFromScroll() {
    this.scrollSwitchQueued = false

    if (this.app.renderer.xr.isPresenting) return

    const closestSection = this.getClosestSectionToViewportCenter()
    if (!closestSection) return

    const simulationName = closestSection.dataset.simulation
    this.setSimulationFromName(simulationName)
  }
}