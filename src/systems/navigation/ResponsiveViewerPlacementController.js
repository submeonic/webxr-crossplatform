export class ResponsiveViewerPlacementController {
  constructor(options = {}) {
    this.viewerElement = options.viewerElement
    this.desktopSlot = options.desktopSlot
    this.controlsElement = options.controlsElement ?? null
    this.desktopControlsSlot = options.desktopControlsSlot ?? this.viewerElement

    this.mobileSlotSelector =
      options.mobileSlotSelector ?? '[data-viewer-slot]'

    this.mobileMediaQuery =
      options.mobileMediaQuery ?? '(max-width: 760px)'

    this.isXRPresenting =
      options.isXRPresenting ?? (() => false)

    this.onPlacementChanged =
      options.onPlacementChanged ?? null

    if (!this.viewerElement) {
      throw new Error(
        'ResponsiveViewerPlacementController requires options.viewerElement',
      )
    }

    if (!this.desktopSlot) {
      throw new Error(
        'ResponsiveViewerPlacementController requires options.desktopSlot',
      )
    }

    this.mediaQueryList = window.matchMedia(
      this.mobileMediaQuery,
    )

    this.activeSimulationName = null
    this.started = false
    this.placementPending = false

    this.handleMediaQueryChange =
      this.handleMediaQueryChange.bind(this)
  }

  start() {
    if (this.started) return

    this.started = true

    if (this.mediaQueryList.addEventListener) {
      this.mediaQueryList.addEventListener(
        'change',
        this.handleMediaQueryChange,
      )
    } else {
      this.mediaQueryList.addListener(
        this.handleMediaQueryChange,
      )
    }

    this.refreshPlacement()
  }

  stop() {
    if (!this.started) return

    this.started = false

    if (this.mediaQueryList.removeEventListener) {
      this.mediaQueryList.removeEventListener(
        'change',
        this.handleMediaQueryChange,
      )
    } else {
      this.mediaQueryList.removeListener(
        this.handleMediaQueryChange,
      )
    }
  }

  handleMediaQueryChange() {
    this.refreshPlacement()
  }

  setActiveSimulation(simulationName) {
    if (!simulationName) return

    this.activeSimulationName = simulationName
    this.refreshPlacement()
  }

  getMobileSlot(simulationName) {
    const slots = document.querySelectorAll(
      this.mobileSlotSelector,
    )

    for (const slot of slots) {
      if (slot.dataset.viewerSlot === simulationName) {
        return slot
      }
    }

    return null
  }

  getMobileControlsSlot(simulationName) {
    return Array.from(document.querySelectorAll('[data-controls-slot]'))
      .find(slot => slot.dataset.controlsSlot === simulationName) ?? null
  }

  getTargetPlacement() {
    const useMobilePlacement =
      this.mediaQueryList.matches &&
      Boolean(this.activeSimulationName)

    if (!useMobilePlacement) {
      return {
        mode: 'desktop',
        targetSlot: this.desktopSlot,
      }
    }

    const mobileSlot = this.getMobileSlot(
      this.activeSimulationName,
    )

    if (!mobileSlot) {
      console.warn(
        `No mobile viewer slot found for "${this.activeSimulationName}"`,
      )

      return {
        mode: 'desktop',
        targetSlot: this.desktopSlot,
      }
    }

    return {
      mode: 'mobile',
      targetSlot: mobileSlot,
    }
  }

  refreshPlacement() {
    if (this.isXRPresenting()) {
      this.placementPending = true
      return false
    }

    const { mode, targetSlot } =
      this.getTargetPlacement()

    this.placementPending = false

    const controlsSlot = mode === 'mobile'
      ? this.getMobileControlsSlot(this.activeSimulationName) ?? this.desktopControlsSlot
      : this.desktopControlsSlot
    const focused = document.activeElement
    const preserveFocus = focused && (
      this.controlsElement?.contains(focused) || this.viewerElement.contains(focused)
    )
    let moved = false
    if (this.viewerElement.parentElement !== targetSlot) {
      targetSlot.appendChild(this.viewerElement)
      moved = true
    }
    if (this.controlsElement && this.controlsElement.parentElement !== controlsSlot) {
      controlsSlot.appendChild(this.controlsElement)
      moved = true
    }
    if (!moved) return false
    if (preserveFocus) focused.focus({ preventScroll: true })

    requestAnimationFrame(() => {
      this.onPlacementChanged?.({
        mode,
        targetSlot,
        simulationName: this.activeSimulationName,
      })
    })

    return true
  }
}
