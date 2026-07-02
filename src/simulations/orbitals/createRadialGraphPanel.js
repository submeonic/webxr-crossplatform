import * as THREE from 'three'

const BOHR_RADIUS_ANGSTROM = 0.529177

export function createRadialGraphPanel({
  samples,
  rMaxA0 = 5.0,
  widthMeters = 1.35,
  heightMeters = 1.08,
} = {}) {
  if (!samples) {
    throw new Error('createRadialGraphPanel requires samples')
  }

  /*
    Original graph was about 500 x 400.
    Keep this aspect ratio to avoid horizontal text stretching.
  */
  const logicalWidth = 500
  const logicalHeight = 400
  const renderScale = 2

  const canvas = document.createElement('canvas')
  canvas.width = logicalWidth * renderScale
  canvas.height = logicalHeight * renderScale

  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthMeters, heightMeters),
    material,
  )

  mesh.name = 'RadialProbabilityGraphPanel'
  mesh.renderOrder = 0
  mesh.frustumCulled = false

  let latestState = {
    innerRadiusA0: 0,
    outerRadiusA0: 0,
    highlightedCount: 0,
    totalCount: samples.count,
  }

  function update(state = {}) {
    latestState = {
      ...latestState,
      ...state,
    }

    draw()
    texture.needsUpdate = true
  }

  function draw() {
    ctx.save()

    ctx.setTransform(
      renderScale,
      0,
      0,
      renderScale,
      0,
      0,
    )

    ctx.clearRect(0, 0, logicalWidth, logicalHeight)

    drawGraph(ctx, {
      state: latestState,
      rMaxA0,
      width: logicalWidth,
      height: logicalHeight,
    })

    ctx.restore()
  }

  function dispose() {
    texture.dispose()
    material.dispose()
    mesh.geometry.dispose()
  }

  update()

  return {
    mesh,
    canvas,
    texture,
    update,
    dispose,
  }
}

/*
  Original graph math:
    graph_1s(i) = 4 / 2500 * i^2 * exp(-i / 50) * exp(-i / 50)

  With i = 50r, this is proportional to:
    4r^2 e^(-2r)
*/
function graph1s(i) {
  return (
    (4 / 2500) *
    i *
    i *
    Math.exp(-i / 50) *
    Math.exp(-i / 50)
  )
}

function drawGraph(ctx, {
  state,
  rMaxA0,
  width,
  height,
}) {
  const xMin = 0
  const xMax = 600

  const yMin = 0
  let yMax = 0

  const dataset = []
  let peakIndex = 0

  for (let i = 0; i < 600; i++) {
    const y = graph1s(i)

    dataset.push({ x: i, y })

    if (y > yMax) {
      yMax = y
      peakIndex = i
    }
  }

  const xScale = (x) => map(x, xMin, xMax, 60, width - 30)
  const yScale = (y) => map(y, yMin, yMax, height - 60, 104)

  const radiusA0ToGraphX = (radiusA0) => {
    return xScale(radiusA0 * 50)
  }

  drawTransparentBacking(ctx, width, height)
  drawTopInfo(ctx, state, width)
  drawAxes(ctx, width, height)
  drawAxisLabels(ctx, width, height)
  draw1sBars(ctx, dataset, xScale, yScale, height)
  drawBohrRadiusMarker(ctx, dataset[peakIndex], xScale, yScale, height)
  drawSelectionLine(ctx, state, radiusA0ToGraphX, yScale, height)
  drawGraphLabel(ctx, xScale)
}

function drawTransparentBacking(ctx, width, height) {
  /*
    Very subtle backing so it still feels close to the reference site.
  */
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
  ctx.fillRect(0, 0, width, height)
}

function drawTopInfo(ctx, state, width) {
  const radiusA0 = state.outerRadiusA0
  const radiusAngstrom = radiusA0 * BOHR_RADIUS_ANGSTROM

  const centerX = width * 0.5

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  /*
    Line 1: large measurement count.
  */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'
  ctx.font = 'bold 28px Arial, Helvetica, sans-serif'
  ctx.fillText(
    `${state.highlightedCount}`,
    centerX,
    24,
  )

  /*
    Line 2: label.
  */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.font = 'bold 14px Arial, Helvetica, sans-serif'
  ctx.fillText(
    'measurements in selected region',
    centerX,
    44,
  )

  /*
    Line 3: radius readout.
  */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.font = 'bold 14px Arial, Helvetica, sans-serif'
  ctx.fillText(
    `radius: ${radiusAngstrom.toFixed(3)} Angstrom`,
    centerX,
    68,
  )

  /*
    Divider line.
  */
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(60, 80)
  ctx.lineTo(width - 30, 80)
  ctx.stroke()
}

function drawAxes(ctx, width, height) {
  const axisX = 58
  const axisY = height - 58

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.5

  /*
    X axis.
  */
  ctx.beginPath()
  ctx.moveTo(axisX, axisY)
  ctx.lineTo(width - 30, axisY)
  ctx.stroke()

  /*
    Y axis.
  */
  ctx.beginPath()
  ctx.moveTo(axisX, axisY)
  ctx.lineTo(axisX, 104)
  ctx.stroke()
}

function drawAxisLabels(ctx, width, height) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.font = 'bold 16px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText(
    'Distance from Nucleus',
    width / 2,
    height - 28,
  )

  ctx.save()
  ctx.translate(28, height / 2 + 18)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('No. of Measurements', 0, 0)
  ctx.restore()

  ctx.textAlign = 'left'
}

function draw1sBars(ctx, dataset, xScale, yScale, height) {
  ctx.strokeStyle = '#FFF7AE'
  ctx.lineWidth = 1

  for (const d of dataset) {
    if (d.x % 10 !== 0) continue

    const x = xScale(d.x)
    const yTop = yScale(d.y)
    const yBottom = height - 58

    ctx.beginPath()
    ctx.moveTo(x, yTop)
    ctx.lineTo(x, yBottom)
    ctx.stroke()
  }
}

function drawBohrRadiusMarker(ctx, peakPoint, xScale, yScale, height) {
  const x = xScale(peakPoint.x)
  const yTop = yScale(peakPoint.y)
  const yBottom = height - 58

  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.moveTo(x, yTop)
  ctx.lineTo(x, yBottom)
  ctx.stroke()

  ctx.fillStyle = 'white'
  ctx.font = 'bold 16px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText(
    'Bohr Radius',
    x + 14,
    height / 2 + 12,
  )
}

function drawSelectionLine(ctx, state, radiusA0ToGraphX, yScale, height) {
  /*
    Single white vertical shell indicator line.
    We use the shell outer radius as the selected radius.
  */
  const selectedRadiusA0 = state.outerRadiusA0

  if (selectedRadiusA0 <= 0) return

  const graphIndex = selectedRadiusA0 * 50
  const yValue = graph1s(graphIndex)

  const x = radiusA0ToGraphX(selectedRadiusA0)
  const yTop = yScale(yValue)
  const yBottom = height - 58

  ctx.strokeStyle = 'white'
  ctx.lineWidth = 3

  ctx.beginPath()
  ctx.moveTo(x, yBottom)
  ctx.lineTo(x, yTop)
  ctx.stroke()
}

function drawGraphLabel(ctx, xScale) {
  /*
    The whole graph is the 1s orbital.
  */
  ctx.fillStyle = '#FFF7AE'
  ctx.fillRect(
    xScale(500),
    112,
    16,
    16,
  )

  ctx.fillStyle = 'white'
  ctx.font = 'bold 16px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText(
    '1s',
    xScale(530),
    126,
  )
}

function map(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / Math.max(0.000001, inMax - inMin)
  return outMin + t * (outMax - outMin)
}