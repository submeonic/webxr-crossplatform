import { BOHR_RADIUS_ANGSTROM } from '../data/sOrbitalDistributions.js'

export const RADIAL_GRAPH_LOGICAL_WIDTH = 500
export const RADIAL_GRAPH_LOGICAL_HEIGHT = 400

const GRAPH_LEFT = 60
const GRAPH_RIGHT_PADDING = 30
const GRAPH_TOP = 104
const GRAPH_BOTTOM = 342
const GRAPH_X_MAX = 600
const GRAPH_INDEX_PER_A0 = 50
const ACTIVE_BAR_STEP = 10

const FONT_DISPLAY = '"Agency FB", Impact, "Arial Narrow", sans-serif'
const FONT_BODY = '"Bai Jamjuree", Arial, Helvetica, sans-serif'

const COLORS = {
  background: '#121212',
  brand: '#fff7ae',
  green: '#6ecf7f',
  text: '#ffffff',
  mutedText: 'rgba(255, 255, 255, 0.68)',
  line: 'rgba(255, 255, 255, 0.14)',
  axis: 'rgba(255, 255, 255, 0.86)',
  selection: '#ffffff',
}

export function radiusA0ToGraphX(
  radiusA0,
  width = RADIAL_GRAPH_LOGICAL_WIDTH,
  xMinA0 = 0,
  xMaxA0 = 12,
) {
  return map(
    radiusA0,
    xMinA0,
    xMaxA0,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
  )
}

export function graphXToRadiusA0(
  x,
  width = RADIAL_GRAPH_LOGICAL_WIDTH,
  xMinA0 = 0,
  xMaxA0 = 12,
) {
  return map(
    x,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
    xMinA0,
    xMaxA0,
  )
}

/**
 * Shared 1s/2s radial graph renderer.
 *
 * Visual language:
 * - compact count/radius readout above the plot
 * - no grid
 * - vertical bars for the active orbital
 * - faint point trace for comparison datasets
 * - shared axes and y scale
 * - white Bohr-radius marker
 * - white selected-radius line with a draggable cue dot
 */
export function drawRadialGraph(ctx, {
  state,
  graphConfig,
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

  const safeConfig = normalizeGraphConfig(graphConfig)
  const datasets = buildDatasets(safeConfig)
  const activeDataset = datasets.find(
    (dataset) => dataset.id === safeConfig.activeDatasetId,
  ) ?? datasets[0]

  const comparisonDatasets = datasets.filter(
    (dataset) => dataset !== activeDataset,
  )

  const yMaximum = resolveYMaximum(safeConfig, datasets)

  const xScale = (graphIndex) => map(
    graphIndex,
    0,
    GRAPH_X_MAX,
    GRAPH_LEFT,
    width - GRAPH_RIGHT_PADDING,
  )

  const yScale = (value) => map(
    value,
    safeConfig.yMin,
    yMaximum,
    GRAPH_BOTTOM,
    GRAPH_TOP,
  )

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = safeConfig.backgroundColor
  ctx.fillRect(0, 0, width, height)

  drawTopInfo(ctx, safeState, width)
  drawAxes(ctx, width)
  drawAxisLabels(ctx, width, height)

  for (const dataset of comparisonDatasets) {
    drawComparisonTrace(ctx, dataset, xScale, yScale)
  }

  if (activeDataset) {
    drawActiveBars(ctx, activeDataset, xScale, yScale)
  }

  drawBohrRadiusMarker(ctx, datasets, xScale, yScale, height)
  drawSelectionLine(
    ctx,
    safeState,
    activeDataset,
    xScale,
    yScale,
    width,
  )
  drawLegend(ctx, datasets, xScale)
}

function normalizeGraphConfig(graphConfig = {}) {
  const datasets = Array.isArray(graphConfig.datasets)
    ? graphConfig.datasets.filter(
      (dataset) => typeof dataset?.getValue === 'function',
    )
    : []

  return {
    xMinA0: 0,
    xMaxA0: 12,
    yMin: 0,
    yMax: null,
    activeDatasetId: datasets[0]?.id ?? null,
    backgroundColor: COLORS.background,
    datasets,
    ...graphConfig,
    datasets,
  }
}

function buildDatasets(graphConfig) {
  return graphConfig.datasets.map((dataset) => {
    const points = []

    for (let graphIndex = 0; graphIndex < GRAPH_X_MAX; graphIndex++) {
      const radiusA0 = graphIndex / GRAPH_INDEX_PER_A0
      const withinConfiguredRange =
        radiusA0 >= graphConfig.xMinA0 &&
        radiusA0 <= graphConfig.xMaxA0

      points.push({
        graphIndex,
        radiusA0,
        value: withinConfiguredRange
          ? Math.max(0, dataset.getValue(radiusA0) || 0)
          : 0,
      })
    }

    return { ...dataset, points }
  })
}

function resolveYMaximum(graphConfig, datasets) {
  if (
    Number.isFinite(graphConfig.yMax) &&
    graphConfig.yMax > graphConfig.yMin
  ) {
    return graphConfig.yMax
  }

  let maximum = 0

  for (const dataset of datasets) {
    for (const point of dataset.points) {
      maximum = Math.max(maximum, point.value)
    }
  }

  return Math.max(0.000001, maximum)
}

function drawTopInfo(ctx, state, width) {
  const radiusAngstrom =
    state.outerRadiusA0 * BOHR_RADIUS_ANGSTROM
  const centerX = width * 0.5

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = COLORS.brand
  ctx.font = `bold 34px ${FONT_DISPLAY}`
  ctx.fillText(`${state.highlightedCount}`, centerX, 32)

  ctx.fillStyle = COLORS.mutedText
  ctx.font = `600 14px ${FONT_BODY}`
  ctx.fillText(
    'measurements in selected region',
    centerX,
    53,
  )

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

function drawAxes(ctx, width) {
  ctx.strokeStyle = COLORS.axis
  ctx.lineWidth = 1.25

  ctx.beginPath()
  ctx.moveTo(GRAPH_LEFT, GRAPH_BOTTOM)
  ctx.lineTo(width - GRAPH_RIGHT_PADDING, GRAPH_BOTTOM)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(GRAPH_LEFT - 2, GRAPH_BOTTOM)
  ctx.lineTo(GRAPH_LEFT - 2, GRAPH_TOP - 6)
  ctx.stroke()
}

function drawAxisLabels(ctx, width, height) {
  ctx.fillStyle = COLORS.text
  ctx.font = `500 15px ${FONT_BODY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText('Distance from Nucleus', width / 2, height - 28)

  ctx.save()
  ctx.translate(28, (GRAPH_TOP + GRAPH_BOTTOM) * 0.5 + 16)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('No. of Measurements', 0, 0)
  ctx.restore()
}

function drawActiveBars(ctx, dataset, xScale, yScale) {
  ctx.save()
  ctx.globalAlpha = dataset.opacity ?? 1
  ctx.strokeStyle = dataset.color ?? COLORS.green
  ctx.lineWidth = dataset.lineWidth ?? 1

  for (const point of dataset.points) {
    if (point.graphIndex % ACTIVE_BAR_STEP !== 0) {
      continue
    }

    const x = xScale(point.graphIndex)
    const yTop = yScale(point.value)

    ctx.beginPath()
    ctx.moveTo(x, yTop)
    ctx.lineTo(x, GRAPH_BOTTOM)
    ctx.stroke()
  }

  ctx.restore()
}

function drawComparisonTrace(ctx, dataset, xScale, yScale) {
  ctx.save()
  ctx.globalAlpha = dataset.opacity ?? 0.1
  ctx.fillStyle = dataset.color ?? COLORS.brand

  for (const point of dataset.points) {
    const x = xScale(point.graphIndex)
    const y = yScale(point.value)

    ctx.beginPath()
    ctx.arc(x, y, dataset.pointRadius ?? 2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawBohrRadiusMarker(ctx, datasets, xScale, yScale, height) {
  const referenceDataset =
    datasets.find((dataset) => dataset.id === '1s') ?? datasets[0]

  if (!referenceDataset) {
    return
  }

  const graphIndex = GRAPH_INDEX_PER_A0
  const point = referenceDataset.points[graphIndex]
  const x = xScale(graphIndex)
  const yTop = yScale(point?.value ?? 0)

  ctx.strokeStyle = COLORS.text
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, yTop)
  ctx.lineTo(x, GRAPH_BOTTOM)
  ctx.stroke()

  ctx.fillStyle = COLORS.text
  ctx.font = `500 15px ${FONT_BODY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(
    'Bohr Radius',
    x + 14,
    GRAPH_TOP + (GRAPH_BOTTOM - GRAPH_TOP) * 0.50,
  )
}

function drawSelectionLine(
  ctx,
  state,
  activeDataset,
  xScale,
  yScale,
  width,
) {
  if (!activeDataset || state.outerRadiusA0 <= 0) {
    return
  }

  const graphIndex = state.outerRadiusA0 * GRAPH_INDEX_PER_A0
  const value = Math.max(
    0,
    activeDataset.getValue(state.outerRadiusA0) || 0,
  )
  const x = radiusA0ToGraphX(
    state.outerRadiusA0,
    width,
    0,
    12,
  )
  const yTop = yScale(value)

  ctx.strokeStyle = COLORS.selection
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, GRAPH_BOTTOM)
  ctx.lineTo(x, yTop)
  ctx.stroke()

  ctx.fillStyle = COLORS.selection
  ctx.beginPath()
  ctx.arc(xScale(graphIndex), yTop, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawLegend(ctx, datasets, xScale) {
  const preferredOrder = ['1s', '2s']
  const orderedDatasets = [...datasets].sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a.id)
    const bIndex = preferredOrder.indexOf(b.id)

    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  const labelX = xScale(500)
  let labelY = GRAPH_TOP + 8

  for (const dataset of orderedDatasets) {
    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = dataset.color ?? COLORS.brand
    ctx.fillRect(labelX, labelY, 16, 16)
    ctx.restore()

    ctx.fillStyle = COLORS.text
    ctx.font = `500 16px ${FONT_BODY}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(dataset.label ?? dataset.id, labelX + 22, labelY + 14)

    labelY += 30
  }
}

export function formatRadialGraphReadout(state = {}) {
  const outerRadiusA0 = Number.isFinite(state.outerRadiusA0)
    ? state.outerRadiusA0
    : 0

  return {
    highlightedCount: state.highlightedCount ?? 0,
    radiusAngstrom: outerRadiusA0 * BOHR_RADIUS_ANGSTROM,
  }
}

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / Math.max(0.000001, inMax - inMin)
  return outMin + t * (outMax - outMin)
}
