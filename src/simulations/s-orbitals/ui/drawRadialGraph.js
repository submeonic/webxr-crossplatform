const BOHR_RADIUS_ANGSTROM = 0.529177

export const RADIAL_GRAPH_LOGICAL_WIDTH = 500
export const RADIAL_GRAPH_LOGICAL_HEIGHT = 400

const GRAPH_LEFT = 60
const GRAPH_RIGHT_PADDING = 30
const GRAPH_TOP = 104
const GRAPH_BOTTOM_PADDING = 58
const GRAPH_X_MAX = 600

const FONT_DISPLAY = '"Agency FB", Impact, "Arial Narrow", sans-serif'
const FONT_BODY = '"Bai Jamjuree", Arial, Helvetica, sans-serif'

const COLORS = {
  background: '#121212',
  brand: '#fff7ae',
  text: '#ffffff',
  mutedText: 'rgba(255, 255, 255, 0.68)',
  faintText: 'rgba(255, 255, 255, 0.48)',
  line: 'rgba(255, 255, 255, 0.14)',
  axis: 'rgba(255, 255, 255, 0.86)',
  selection: '#ffffff',
}

/*
Original graph math:
graph_1s(i) = 4 / 2500 * i^2 * exp(-i / 50) * exp(-i / 50)

With i = 50r, this is proportional to:
4r^2 e^(-2r)
*/
export function graph1s(index) {
  return (
    (4 / 2500) *
    index *
    index *
    Math.exp(-index / 50) *
    Math.exp(-index / 50)
  )
}

export function radiusA0ToGraphX(radiusA0, width = RADIAL_GRAPH_LOGICAL_WIDTH) {
  const graphIndex = radiusA0 * 50

  return map(
    graphIndex,
    0,
    GRAPH_X_MAX,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
  )
}

export function graphXToRadiusA0(x, width = RADIAL_GRAPH_LOGICAL_WIDTH) {
  const graphIndex = map(
    x,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
    0,
    GRAPH_X_MAX,
  )

  return graphIndex / 50
}

export function drawRadialGraph(ctx, {
  state,
  width = RADIAL_GRAPH_LOGICAL_WIDTH,
  height = RADIAL_GRAPH_LOGICAL_HEIGHT,
} = {}) {
  const safeState = {
    orbitalType: '1s',
    innerRadiusA0: 0,
    outerRadiusA0: 0,
    highlightedCount: 0,
    totalCount: 0,
    ...state,
  }

  const xMin = 0
  const xMax = GRAPH_X_MAX
  const yMin = 0

  let yMax = 0
  const dataset = []
  let peakIndex = 0

  for (let i = 0; i < GRAPH_X_MAX; i++) {
    const y = graph1s(i)

    dataset.push({
      x: i,
      y,
    })

    if (y > yMax) {
      yMax = y
      peakIndex = i
    }
  }

  const xScale = (x) => map(
    x,
    xMin,
    xMax,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
  )

  const yScale = (y) => map(
    y,
    yMin,
    yMax,
    height - GRAPH_BOTTOM_PADDING,
    GRAPH_TOP,
  )

  ctx.clearRect(0, 0, width, height)

  drawTopInfo(ctx, safeState, width)
  drawAxes(ctx, width, height)
  drawAxisLabels(ctx, width, height)
  draw1sBars(ctx, dataset, xScale, yScale, height)
  drawBohrRadiusMarker(ctx, dataset[peakIndex], xScale, yScale, height)
  drawSelectionLine(ctx, safeState, yScale, height, width)
  drawGraphLabel(ctx, safeState, xScale)
}


function drawTopInfo(ctx, state, width) {
  const radiusA0 = state.outerRadiusA0
  const radiusAngstrom = radiusA0 * BOHR_RADIUS_ANGSTROM
  const centerX = width * 0.5

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  /*
  Header-style number: matches the site's display/title feel.
  */
  ctx.fillStyle = COLORS.brand
  ctx.font = `bold 34px ${FONT_DISPLAY}`
  ctx.fillText(`${state.highlightedCount}`, centerX, 32)

  /*
  Body-style subtitle.
  */
  ctx.fillStyle = COLORS.mutedText
  ctx.font = `600 14px ${FONT_BODY}`
  ctx.fillText('measurements in selected region', centerX, 53)

  ctx.fillStyle = COLORS.text
  ctx.font = `600 14px ${FONT_BODY}`
  ctx.fillText(
    `radius: ${radiusAngstrom.toFixed(3)} Angstrom`,
    centerX,
    75,
  )

  ctx.strokeStyle = COLORS.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(GRAPH_LEFT, 88)
  ctx.lineTo(width - GRAPH_RIGHT_PADDING, 88)
  ctx.stroke()
}

function drawAxes(ctx, width, height) {
  const axisX = GRAPH_LEFT
  const axisY = height - GRAPH_BOTTOM_PADDING

  ctx.strokeStyle = COLORS.axis
  ctx.lineWidth = 1.25

  ctx.beginPath()
  ctx.moveTo(axisX, axisY)
  ctx.lineTo(width - GRAPH_RIGHT_PADDING, axisY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(axisX, axisY)
  ctx.lineTo(axisX, GRAPH_TOP)
  ctx.stroke()
}

function drawAxisLabels(ctx, width, height) {
  ctx.fillStyle = COLORS.text
  ctx.font = `600 15px ${FONT_BODY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText('Distance from Nucleus', width / 2, height - 28)

  ctx.save()
  ctx.translate(28, height / 2 + 18)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('No. of Measurements', 0, 0)
  ctx.restore()

  ctx.textAlign = 'left'
}

function draw1sBars(ctx, dataset, xScale, yScale, height) {
  ctx.strokeStyle = COLORS.brand
  ctx.lineWidth = 1

  for (const d of dataset) {
    if (d.x % 10 !== 0) {
      continue
    }

    const x = xScale(d.x)
    const yTop = yScale(d.y)
    const yBottom = height - GRAPH_BOTTOM_PADDING

    ctx.beginPath()
    ctx.moveTo(x, yTop)
    ctx.lineTo(x, yBottom)
    ctx.stroke()
  }
}

function drawBohrRadiusMarker(ctx, peakPoint, xScale, yScale, height) {
  const x = xScale(peakPoint.x)
  const yTop = yScale(peakPoint.y)
  const yBottom = height - GRAPH_BOTTOM_PADDING

  ctx.strokeStyle = COLORS.text
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, yTop)
  ctx.lineTo(x, yBottom)
  ctx.stroke()

  ctx.fillStyle = COLORS.text
  ctx.font = `600 15px ${FONT_BODY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Bohr Radius', x + 14, height / 2 + 12)
}

function drawSelectionLine(ctx, state, yScale, height, width) {
  const selectedRadiusA0 = state.outerRadiusA0

  if (selectedRadiusA0 <= 0) {
    return
  }

  const graphIndex = selectedRadiusA0 * 50
  const yValue = graph1s(graphIndex)
  const x = radiusA0ToGraphX(selectedRadiusA0, width)
  const yTop = yScale(yValue)
  const yBottom = height - GRAPH_BOTTOM_PADDING

  /*
  White vertical shell indicator line.
  */
  ctx.strokeStyle = COLORS.selection
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, yBottom)
  ctx.lineTo(x, yTop)
  ctx.stroke()

  /*
  Small draggable handle cue for desktop without making it look like a modern UI widget.
  */
  ctx.fillStyle = COLORS.selection
  ctx.beginPath()
  ctx.arc(x, yTop, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawGraphLabel(ctx, state, xScale) {
  const orbitalLabel = state.orbitalType ?? '1s'

  ctx.fillStyle = COLORS.brand
  ctx.fillRect(xScale(500), 112, 16, 16)

  ctx.fillStyle = COLORS.text
  ctx.font = `600 16px ${FONT_BODY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(orbitalLabel, xScale(530), 126)
}

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / Math.max(0.000001, inMax - inMin)

  return outMin + t * (outMax - outMin)
}