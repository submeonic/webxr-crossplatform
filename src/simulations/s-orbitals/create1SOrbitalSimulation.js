import { createSOrbitalSimulationBase } from './createSOrbitalSimulationBase.js'
import {
  radialProbability1s,
} from './data/sOrbitalDistributions.js'
import { generate1sSamples } from './data/sOrbitalSamplers.js'

const YELLOW = '#fff7ae'
const SHARED_GRAPH_Y_MAX = 0.56

export function create1SOrbitalSimulation(app) {
  return createSOrbitalSimulationBase(app, {
    id: '1s-orbital',
    label: '1s',

    xrMenuLabel: '1s',
    xrMenuOrder: 1,
    showInXRMenu: true,

    sampleGenerator: generate1sSamples,
    seed: 1001,
    electronCount: 1800,

    sampleMaxRadiusA0: 5,
    shellMinRadiusA0: 0.15,
    shellMaxRadiusA0: 12,
    graphMaxRadiusA0: 12,

    initialShellOuterRadiusA0: 1.15,
    shellThicknessA0: 0.15,
    shellDragGainA0PerMeter: 1.25,

    a0ToMeters: 0.25,
    pointColor: 0xeadfad,
    pointOpacity: 0.18,
    highlightColor: 0xfff7ae,
    highlightOpacity: 0.95,
    shellColor: 0xfff7ae,

    desktopGraphContainerId: '1s-orbital-desktop-graph',
    desktopGraphAriaLabel:
      '1s orbital radial probability graph',

    graphConfig: {
      xMinA0: 0,
      xMaxA0: 12,
      yMin: 0,
      yMax: SHARED_GRAPH_Y_MAX,
      activeDatasetId: '1s',
      datasets: [
        {
          id: '1s',
          label: '1s',
          role: 'primary',
          color: YELLOW,
          opacity: 1,
          lineWidth: 4,
          lineStyle: 'solid',
          getValue: radialProbability1s,
        },
      ],
    },
  })
}
