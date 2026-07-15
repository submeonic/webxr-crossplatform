import { createSOrbitalSimulationBase } from './createSOrbitalSimulationBase.js'
import {
  radialProbability1s,
  radialProbability2s,
} from './data/sOrbitalDistributions.js'
import { generate2sSamples } from './data/sOrbitalSamplers.js'

const YELLOW = '#fff7ae'
const GREEN = '#6ecf7f'
const SHARED_GRAPH_Y_MAX = 0.56

export function create2SOrbitalSimulation(app) {
  return createSOrbitalSimulationBase(app, {
    id: '2s-orbital',
    label: '2s',

    xrMenuLabel: '2s',
    xrMenuOrder: 2,
    showInXRMenu: true,

    sampleGenerator: generate2sSamples,
    seed: 2002,
    electronCount: 1800,

    sampleMaxRadiusA0: 12,
    shellMinRadiusA0: 0.15,
    shellMaxRadiusA0: 12,
    graphMaxRadiusA0: 12,

    initialShellOuterRadiusA0: 5.35,
    shellThicknessA0: 0.15,
    shellDragGainA0PerMeter: 1.25,

    a0ToMeters: 0.25,
    pointColor: 0x6ecf7f,
    pointOpacity: 0.18,
    highlightColor: 0xa7ffb3,
    highlightOpacity: 0.98,
    shellColor: 0x6ecf7f,

    desktopGraphContainerId: '2s-orbital-desktop-graph',
    desktopGraphAriaLabel:
      '2s orbital radial probability graph with 1s comparison',

    graphConfig: {
      xMinA0: 0,
      xMaxA0: 12,
      yMin: 0,
      yMax: SHARED_GRAPH_Y_MAX,
      activeDatasetId: '2s',
      datasets: [
        {
          id: '2s',
          label: '2s',
          role: 'primary',
          color: GREEN,
          opacity: 1,
          lineWidth: 4,
          lineStyle: 'solid',
          getValue: radialProbability2s,
        },
        {
          id: '1s',
          label: '1s',
          role: 'comparison',
          color: YELLOW,
          opacity: 0.35,
          lineWidth: 2.5,
          lineStyle: 'solid',
          getValue: radialProbability1s,
        },
      ],
    },
  })
}
