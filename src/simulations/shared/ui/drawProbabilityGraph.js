import { FONT_DISPLAY, FONT_BODY } from '../../../systems/ui/interfaceTheme.js'
import { getCoverageFrames, coverageAt, clampCoverage, DZ2_RING_PROBABILITY } from '../data/probabilityCoverage.js'

const LEFT = 88, RIGHT = 470, TOP = 110, BOTTOM = 328
export function coverageGraphMaximum(type) {
  return getCoverageFrames(type).at(-1).volume * 1.06
}

// Horizontal input now selects probability directly, independent of orbital size.
export function graphXToProbability(x) {
  return clampCoverage(Math.max(0, Math.min(1, (x - LEFT) / (RIGHT - LEFT))))
}

const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

export function drawProbabilityGraph(ctx, { state = {}, width = 500, height = 400 } = {}) {
  const type = state.coverageType ?? '2p', frames = getCoverageFrames(type)
  const maxVolume = coverageGraphMaximum(type)
  const x = probability => LEFT + probability * (RIGHT - LEFT)
  const y = volume => BOTTOM - volume / maxVolume * (BOTTOM - TOP)
  const coverage = state.probability ?? 0
  const revealed = state.revealedCount ?? 0, count = state.highlightedCount ?? 0

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#121212'
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff7ae'
  ctx.font = `bold 30px ${FONT_DISPLAY}`
  ctx.fillText(coverage ? `${(coverage * 100).toFixed(1)}% probability` : 'Enclosure off', width / 2, 30)
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  ctx.font = `600 18px ${FONT_BODY}`
  ctx.fillText(`${count} inside / ${revealed} outcomes plotted`, width / 2, 53)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(coverage ? `enclosed volume: ${number(state.volume ?? 0)} a₀³`
    : 'Drag across graph to grow the enclosure', width / 2, 75)
  ctx.strokeStyle = 'rgba(255,255,255,.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(LEFT, 89)
  ctx.lineTo(RIGHT, 89)
  ctx.stroke()

  for (const probability of [0.5, 0.9]) {
    ctx.strokeStyle = 'rgba(255,255,255,.16)'
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    ctx.moveTo(x(probability), BOTTOM)
    ctx.lineTo(x(probability), TOP)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.strokeStyle = 'rgba(255,255,255,.8)'
  ctx.beginPath()
  ctx.moveTo(LEFT, TOP)
  ctx.lineTo(LEFT, BOTTOM)
  ctx.lineTo(RIGHT, BOTTOM)
  ctx.stroke()

  // Both series use the same enclosure at each volume. A sampling discrepancy
  // moves an observed point horizontally; it never changes the model's volume.
  const modelColor = type === '2p' ? '#ea9fa2' : '#80b9ff'
  ctx.strokeStyle = modelColor
  ctx.lineWidth = 2.5
  ctx.beginPath()
  frames.forEach((frame, i) => {
    if (!i) ctx.moveTo(x(frame.probability), y(frame.volume))
    else ctx.lineTo(x(frame.probability), y(frame.volume))
  })
  ctx.stroke()
  if (revealed) {
    ctx.fillStyle = '#fff7ae'
    for (let i = 0; i < frames.length; i += 4) {
      const observed = state.observedCounts?.[i]
      if (observed === undefined) continue
      ctx.beginPath()
      ctx.arc(x(observed / revealed), y(frames[i].volume), 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (type === '3dz2') {
    const event = coverageAt(type, DZ2_RING_PROBABILITY)
    ctx.strokeStyle = 'rgba(255,255,255,.4)'
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(x(event.probability), BOTTOM)
    ctx.lineTo(x(event.probability), TOP + 48)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,.8)'
    ctx.font = `16px ${FONT_BODY}`
    ctx.fillText('Ring begins ≈ 29.8%', LEFT + 10, TOP + 41)
  }
  if (coverage) {
    const selectedX = x(coverage), selectedY = y(state.volume ?? 0)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(selectedX, BOTTOM)
    ctx.lineTo(selectedX, selectedY)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(selectedX, selectedY, 4, 0, Math.PI * 2)
    ctx.fill()
    if (revealed) {
      ctx.fillStyle = '#fff7ae'
      ctx.beginPath()
      ctx.arc(x(count / revealed), selectedY, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.font = `16px ${FONT_BODY}`
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.textAlign = 'center'
  for (const probability of [0, 0.5, 0.9, 1]) {
    ctx.fillText(`${probability * 100}%`, x(probability), BOTTOM + 19)
  }
  ctx.textAlign = 'right'
  for (const volume of [0, maxVolume / 2, maxVolume]) {
    ctx.fillText(number(volume), LEFT - 8, y(volume) + 5)
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.fillText('Enclosed probability / measured fraction', (LEFT + RIGHT) / 2, height - 23)
  ctx.save()
  ctx.translate(17, (TOP + BOTTOM) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('Enclosed volume (a₀³)', 0, 0)
  ctx.restore()
  ctx.fillStyle = modelColor
  ctx.textAlign = 'left'
  ctx.fillText('━ Model', LEFT + 8, TOP + 15)
  ctx.fillStyle = '#fff7ae'
  ctx.fillText('• Measurements', LEFT + 100, TOP + 15)
}
