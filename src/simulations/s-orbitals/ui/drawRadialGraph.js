import { BOHR_RADIUS_ANGSTROM } from '../data/sOrbitalDistributions.js'

export const RADIAL_GRAPH_LOGICAL_WIDTH = 500
export const RADIAL_GRAPH_LOGICAL_HEIGHT = 400

const GRAPH_LEFT = 60
const GRAPH_RIGHT_PADDING = 30
const GRAPH_TOP = 104
const GRAPH_BOTTOM_PADDING = 58

const FONT_DISPLAY = '"Agency FB", Impact, "Arial Narrow", sans-serif'
const FONT_BODY = '"Bai Jamjuree", Arial, Helvetica, sans-serif'

const COLORS = {
  background: '#121212',
  brand: '#fff7ae',
  text: '#ffffff',
  mutedText: 'rgba(255, 255, 255, 0.68)',
  line: 'rgba(255, 255, 255, 0.14)',
  grid: 'rgba(255, 255, 255, 0.08)',
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
  const sampledDatasets = sampleDatasets(safeConfig)
  const yMaximum = resolveYMaximum(safeConfig, sampledDatasets)

  const xScale = (radiusA0) => radiusA0ToGraphX(
    radiusA0,
    width,
    safeConfig.xMinA0,
    safeConfig.xMaxA0,
  )

  const yScale = (value) => map(
    value,
    safeConfig.yMin,
    yMaximum,
    height - GRAPH_BOTTOM_PADDING,
    GRAPH_TOP,
  )

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = safeConfig.backgroundColor
  ctx.fillRect(0, 0, width, height)

  drawTopInfo(ctx, safeState, width, safeConfig)
  drawGrid(ctx, width, height, safeConfig, xScale)
  drawAxes(ctx, width, height)
  drawAxisLabels(ctx, width, height)

  for (const dataset of sampledDatasets) {
    drawDataset(ctx, dataset, xScale, yScale)
  }

  drawBohrRadiusMarker(ctx, xScale, height, safeConfig)
  drawSelectionLine(
    ctx,
    safeState,
    safeConfig,
    sampledDatasets,
    xScale,
    yScale,
    height,
  )
  drawLegend(ctx, safeConfig, width)
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
    sampleCount: 360,
    activeDatasetId: datasets[0]?.id ?? null,
    backgroundColor: COLORS.background,
    datasets,
    ...graphConfig,
    datasets,
  }
}

function sampleDatasets(graphConfig) {
  const sampleCount = Math.max(2, graphConfig.sampleCount)

  return graphConfig.datasets.map((dataset) => {
    const points = []

    for (let index = 0; index <= sampleCount; index++) {
      const t = index / sampleCount
      const radiusA0 = lerp(
        graphConfig.xMinA0,
        graphConfig.xMaxA0,
        t,
      )

      points.push({
        radiusA0,
        value: Math.max(0, dataset.getValue(radiusA0) || 0),
      })
    }

    return {
      ...dataset,
      points,
    }
  })
}

function resolveYMaximum(graphConfig, sampledDatasets) {
  if (Number.isFinite(graphConfig.yMax) && graphConfig.yMax > graphConfig.yMin) {
    return graphConfig.yMax
  }

  let maximum = 0

  for (const dataset of sampledDatasets) {
    for (const point of dataset.points) {
      maximum = Math.max(maximum, point.value)
    }
  }

  return Math.max(0.000001, maximum * 1.04)
}

function drawTopInfo(ctx, state, width, graphConfig) {
  const radiusAngstrom =
    state.outerRadiusA0 * BOHR_RADIUS_ANGSTROM
  const centerX = width * 0.5
  const activeDataset = graphConfig.datasets.find(
    (dataset) => dataset.id === graphConfig.activeDatasetId,
  )

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = activeDataset?.color ?? COLORS.brand
  ctx.font = `bold 34px ${FONT_DISPLAY}`
  ctx.fillText(`${state.highlightedCount}`, centerX, 32)

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

function drawGrid(ctx, width, height, graphConfig, xScale) {
  const graphBottom = height - GRAPH_BOTTOM_PADDING

  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1

  for (
    let radiusA0 = Math.ceil(graphConfig.xMinA0);
    radiusA0 <= graphConfig.xMaxA0;
    radiusA0++
  ) {
    const x = xScale(radiusA0)

    ctx.beginPath()
    ctx.moveTo(x, GRAPH_TOP)
    ctx.lineTo(x, graphBottom)
    ctx.stroke()
  }

  for (let index = 1; index < 4; index++) {
    const y = lerp(GRAPH_TOP, graphBottom, index / 4)

    ctx.beginPath()
    ctx.moveTo(GRAPH_LEFT, y)
    ctx.lineTo(width - GRAPH_RIGHT_PADDING, y)
    ctx.stroke()
  }
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
}

function drawDataset(ctx, dataset, xScale, yScale) {
  if (dataset.points.length < 2) {
    return
  }

  ctx.save()
  ctx.globalAlpha = dataset.opacity ?? 1
  ctx.strokeStyle = dataset.color ?? COLORS.brand
  ctx.lineWidth = dataset.lineWidth ?? 3
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (dataset.lineStyle === 'dashed') {
    ctx.setLineDash([8, 7])
  }

  ctx.beginPath()

  dataset.points.forEach((point, index) => {
    const x = xScale(point.radiusA0)
    const y = yScale(point.value)

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()
  ctx.restore()
}

function drawBohrRadiusMarker(ctx, xScale, height, graphConfig) {
  if (graphConfig.xMinA0 > 1 || graphConfig.xMaxA0 < 1) {
    return
  }

  const x = xScale(1)
  const yBottom = height - GRAPH_BOTTOM_PADDING

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.44)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 5])
  ctx.beginPath()
  ctx.moveTo(x, GRAPH_TOP)
  ctx.lineTo(x, yBottom)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = COLORS.text
  ctx.font = `600 13px ${FONT_BODY}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Bohr Radius', x + 8, GRAPH_TOP + 18)
}

function drawSelectionLine(
  ctx,
  state,
  graphConfig,
  sampledDatasets,
  xScale,
  yScale,
  height,
) {
  const selectedRadiusA0 = state.outerRadiusA0

  if (
    selectedRadiusA0 < graphConfig.xMinA0 ||
    selectedRadiusA0 > graphConfig.xMaxA0
  ) {
    return
  }

  const activeDataset = sampledDatasets.find(
    (dataset) => dataset.id === graphConfig.activeDatasetId,
  ) ?? sampledDatasets[0]

  const selectedValue = activeDataset?.getValue(selectedRadiusA0) ?? 0
  const x = xScale(selectedRadiusA0)
  const y = yScale(selectedValue)
  const yBottom = height - GRAPH_BOTTOM_PADDING

  ctx.strokeStyle = COLORS.selection
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, GRAPH_TOP)
  ctx.lineTo(x, yBottom)
  ctx.stroke()

  ctx.fillStyle = COLORS.selection
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fill()
}

function drawLegend(ctx, graphConfig, width) {
  if (graphConfig.datasets.length === 0) {
    return
  }

  const itemGap = 70
  const totalWidth =
    (graphConfig.datasets.length - 1) * itemGap + 52
  let x = Math.max(GRAPH_LEFT, width - GRAPH_RIGHT_PADDING - totalWidth)
  const y = GRAPH_TOP + 20

  for (const dataset of graphConfig.datasets) {
    ctx.save()
    ctx.globalAlpha = dataset.opacity ?? 1
    ctx.fillStyle = dataset.color ?? COLORS.brand
    ctx.fillRect(x, y - 11, 16, 4)
    ctx.restore()

    ctx.fillStyle = COLORS.text
    ctx.font = `600 14px ${FONT_BODY}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(dataset.label ?? dataset.id, x + 22, y - 3)

    x += itemGap
  }
}

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / Math.max(0.000001, inMax - inMin)

  return outMin + t * (outMax - outMin)
}

function lerp(start, end, t) {
  return start + (end - start) * t
}
