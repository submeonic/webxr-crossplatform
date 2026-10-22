import test from 'node:test'
import assert from 'node:assert/strict'
import { drawProbabilityGraph, graphXToProbability, coverageGraphMaximum } from '../src/simulations/shared/ui/drawProbabilityGraph.js'
import { coverageAt, getCoverageFrames } from '../src/simulations/shared/data/probabilityCoverage.js'

test('horizontal graph input selects the same probability for every orbital, with Off and 5–90% limits', () => {
  const x = probability => 88 + probability * 382
  for (const [input, expected] of [[-.2, 0], [0, 0], [.02, 0], [.03, .05], [.05, .05], [.5, .5], [.9, .9], [1.2, .9]]) {
    assert.ok(Math.abs(graphXToProbability(x(input)) - expected) < 1e-12)
  }
})

test('transposed graph keeps measured fractions at the model enclosure volume, including 100% early samples', () => {
  for (const type of ['2p', '3d', '3dz2']) {
    const arcs = [], texts = []
    const ctx = new Proxy({
      arc(x, y, radius) { arcs.push({ x, y, radius }) },
      fillText(text) { texts.push(text) },
    }, { get: (target, key) => key in target ? target[key] : () => {} })
    const selected = coverageAt(type, .5)
    drawProbabilityGraph(ctx, { state: {
      coverageType: type, probability: .5, volume: selected.volume,
      revealedCount: 1, highlightedCount: 1,
      observedCounts: getCoverageFrames(type).map(() => 1),
    } })
    const [model, measured] = arcs.slice(-2)
    assert.equal(model.x, 279)
    assert.equal(measured.x, 470)
    assert.equal(model.y, measured.y)
    assert.equal(model.y, 328 - selected.volume / coverageGraphMaximum(type) * 218)
    assert.ok(arcs.every(point => point.x >= 88 && point.x <= 470 && point.y >= 110 && point.y <= 328))
    assert.ok(texts.includes('Enclosed volume (a₀³)'))
    assert.ok(texts.includes('Enclosed probability / measured fraction'))
    assert.equal(texts.some(text => text.includes('Ring begins')), type === '3dz2')
  }
})
