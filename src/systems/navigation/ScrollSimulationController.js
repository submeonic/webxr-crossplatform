export class ScrollSimulationController {
  constructor(options = {}) {
    this.app = options.app
    this.simulations = options.simulations ?? {}
    this.sectionSelector = options.sectionSelector ?? '[data-simulation]'
    this.initialSimulationName = options.initialSimulationName ?? null
    this.logChanges = options.logChanges ?? false
    this.onSimulationChange = options.onSimulationChange ?? null

    if (!this.app) {
      throw new Error('ScrollSimulationController requires options.app')
    }

    this.sections = []
    this.activeSimulationName = null
    this.activeSectionElement = null
    this.scrollSwitchQueued = false
    this.started = false

    this.queueUpdate = this.queueUpdate.bind(this)
    this.updateFromScroll = this.updateFromScroll.bind(this)
  }

  start() {
    if (this.started) return

    this.started = true
    this.refreshSections({ queueUpdate: false })

    if (this.initialSimulationName) {
      const initialSection = this.findSectionForSimulation(
        this.initialSimulationName,
      )

      this.setSimulationFromName(
        this.initialSimulationName,
        initialSection,
      )
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

  refreshSections({ queueUpdate = true } = {}) {
    this.sections = Array.from(
      document.querySelectorAll(this.sectionSelector),
    )

    if (queueUpdate) {
      this.queueUpdate()
    }
  }

  findSectionForSimulation(simulationName) {
    return (
      this.sections.find(
        (section) =>
          section.dataset.simulation === simulationName,
      ) ?? null
    )
  }

  setSimulationFromName(
    simulationName,
    sectionElement = this.findSectionForSimulation(simulationName),
  ) {
    if (!simulationName) return

    const simulation = this.simulations[simulationName]

    if (!simulation) {
      console.warn(`No simulation registered for "${simulationName}"`)
      return
    }

    const simulationChanged =
      simulationName !== this.activeSimulationName

    const sectionChanged =
      sectionElement !== this.activeSectionElement

    if (!simulationChanged && !sectionChanged) {
      return
    }

    this.activeSimulationName = simulationName
    this.activeSectionElement = sectionElement

    if (simulationChanged) {
      this.app.setActiveSimulation(simulation)

      if (this.logChanges) {
        console.log(`Active simulation: ${simulationName}`)
      }
    }

    this.onSimulationChange?.({
      simulationName,
      simulation,
      sectionElement,
    })
  }

  getSectionAtViewportActivationLine() {
    const activationLineY = window.innerHeight * 0.5

    for (const section of this.sections) {
      const rect = section.getBoundingClientRect()

      if (
        rect.top <= activationLineY &&
        rect.bottom >= activationLineY
      ) {
        return section
      }
    }

    return null
  }

  getClosestSectionToViewportCenter() {
    const sectionAtActivationLine =
      this.getSectionAtViewportActivationLine()

    if (sectionAtActivationLine) {
      return sectionAtActivationLine
    }

    const viewportCenterY = window.innerHeight * 0.5

    let closestSection = null
    let closestDistance = Infinity

    for (const section of this.sections) {
      const rect = section.getBoundingClientRect()

      const isVisible =
        rect.bottom > 0 &&
        rect.top < window.innerHeight

      if (!isVisible) continue

      const sectionCenterY =
        rect.top + rect.height * 0.5

      const distance = Math.abs(
        sectionCenterY - viewportCenterY,
      )

      if (distance < closestDistance) {
        closestDistance = distance
        closestSection = section
      }
    }

    return closestSection
  }

  queueUpdate() {
    if (!this.started) return
    if (this.scrollSwitchQueued) return

    this.scrollSwitchQueued = true
    requestAnimationFrame(this.updateFromScroll)
  }

  updateFromScroll() {
    this.scrollSwitchQueued = false

    if (this.app.renderer.xr.isPresenting) return

    const closestSection =
      this.getClosestSectionToViewportCenter()

    if (!closestSection) return

    const simulationName =
      closestSection.dataset.simulation

    this.setSimulationFromName(
      simulationName,
      closestSection,
    )
  }
}
