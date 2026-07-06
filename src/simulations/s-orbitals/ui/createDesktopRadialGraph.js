import {
  RADIAL_GRAPH_LOGICAL_HEIGHT,
  RADIAL_GRAPH_LOGICAL_WIDTH,
  drawRadialGraph,
  graphXToRadiusA0,
} from './drawRadialGraph.js'

export function createDesktopRadialGraph({
  containerId = 's-orbitals-desktop-graph',
  samples,
  minRadiusA0 = 0,
  maxRadiusA0 = 5,
  onRadiusChange = null,
} = {}) {
  const container = document.getElementById(containerId)

  if (!container) {
    console.warn(
      `[createDesktopRadialGraph] Could not find container #${containerId}. Desktop graph disabled.`,
    )

    return createDisabledDesktopGraph()
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'S orbital radial probability graph')

  container.innerHTML = ''
  container.appendChild(canvas)

  let latestState = {
    orbitalType: '1s',
    innerRadiusA0: 0,
    outerRadiusA0: 0,
    highlightedCount: 0,
    totalCount: samples?.count ?? 0,
  }

  let isDragging = false
  let disposed = false

  function resize() {
    if (disposed) {
        return
    }

    const devicePixelRatio = window.devicePixelRatio || 1

    /*
    Use clientWidth/clientHeight instead of getBoundingClientRect().
    This avoids feeding the container's border-box size back into the
    child canvas size, which can create an infinite vertical growth loop.
    */
    const cssWidth = Math.max(1, container.clientWidth)
    const cssHeight = cssWidth * (RADIAL_GRAPH_LOGICAL_HEIGHT / RADIAL_GRAPH_LOGICAL_WIDTH)

    const nextCanvasWidth = Math.round(cssWidth * devicePixelRatio)
    const nextCanvasHeight = Math.round(cssHeight * devicePixelRatio)

    if (
        canvas.width !== nextCanvasWidth ||
        canvas.height !== nextCanvasHeight
    ) {
        canvas.width = nextCanvasWidth
        canvas.height = nextCanvasHeight
    }

    /*
    Do not set canvas.style.width or canvas.style.height here.
    Let CSS control the displayed size:
        .desktop-radial-graph canvas { width: 100%; height: 100%; }
    */

    draw()
  }

  function update(state = {}) {
    latestState = {
      ...latestState,
      ...state,
    }

    draw()
  }

  function draw() {
    if (disposed) {
      return
    }

    const width = canvas.width
    const height = canvas.height

    if (width <= 0 || height <= 0) {
      return
    }

    const scaleX = width / RADIAL_GRAPH_LOGICAL_WIDTH
    const scaleY = height / RADIAL_GRAPH_LOGICAL_HEIGHT

    ctx.save()
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0)

    drawRadialGraph(ctx, {
      state: latestState,
      width: RADIAL_GRAPH_LOGICAL_WIDTH,
      height: RADIAL_GRAPH_LOGICAL_HEIGHT,
    })

    ctx.restore()
  }

  function setVisible(visible) {
    container.classList.toggle('is-hidden', !visible)
  }

  function pointerToRadiusA0(event) {
    const rect = canvas.getBoundingClientRect()
    const normalizedX = (event.clientX - rect.left) / Math.max(1, rect.width)
    const logicalX = normalizedX * RADIAL_GRAPH_LOGICAL_WIDTH

    return clamp(
      graphXToRadiusA0(logicalX, RADIAL_GRAPH_LOGICAL_WIDTH),
      minRadiusA0,
      maxRadiusA0,
    )
  }

  function applyPointerRadius(event) {
    const nextRadiusA0 = pointerToRadiusA0(event)

    if (typeof onRadiusChange === 'function') {
      onRadiusChange(nextRadiusA0)
    }
  }

  function handlePointerDown(event) {
    isDragging = true
    canvas.setPointerCapture(event.pointerId)
    applyPointerRadius(event)
  }

  function handlePointerMove(event) {
    if (!isDragging) {
      return
    }

    applyPointerRadius(event)
  }

  function handlePointerUp(event) {
    isDragging = false

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }

  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerUp)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)

  resize()

  function dispose() {
    disposed = true

    resizeObserver.disconnect()

    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', handlePointerUp)
    canvas.removeEventListener('pointercancel', handlePointerUp)

    canvas.remove()
  }

  return {
    container,
    canvas,
    update,
    setVisible,
    dispose,
  }
}

function createDisabledDesktopGraph() {
  return {
    update() {},
    setVisible() {},
    dispose() {},
  }
}

function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue)
}