import { createSOrbitalSimulationBase } from './createSOrbitalSimulationBase.js'
import {
  radialProbability1s,
  radialProbability2s,
} from './data/sOrbitalDistributions.js'
import { generate2sSamples } from './data/sOrbitalSamplers.js'

const YELLOW = '#fff7ae'
const GREEN = '#6ecf7f'
const SHARED_GRAPH_Y_MAX = radialProbability1s(1)

export function create2SOrbitalSimulation(app) {
  return createSOrbitalSimulationBase(app, {
    id: '2s-orbital',
    label: '2s',

    xrMenuLabel: '2s',
    xrMenuOrder: 2,
    showInXRMenu: true,

    sampleGenerator: generate2sSamples,
    seed: 2002,
    electronCount: 5000,

    sampleMaxRadiusA0: 12,
    shellMinRadiusA0: 0.25,
    shellMaxRadiusA0: 12,
    graphMaxRadiusA0: 12,

    initialShellOuterRadiusA0: 5.35,
    shellThicknessA0: 0.25,

    simulationScale: 0.6,
    webInitialCameraDistance: 2.5,
    xrFullRangeDragDistanceMeters: 0.18,

    a0ToMeters: 0.25,
    electronRadiusMeters: 0.018,
    nucleusRadiusMeters: 0.055,

    // Keep the atom itself visually consistent with 1s.
    pointColor: 0xeadfad,
    pointOpacity: 0.16,
    highlightColor: 0xfff7ae,
    highlightOpacity: 0.98,
    shellColor: 0xfff7ae,

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
          id: '1s',
          label: '1s',
          role: 'comparison',
          renderStyle: 'points',
          color: YELLOW,
          opacity: 0.10,
          pointRadius: 2,
          getValue: radialProbability1s,
        },
        {
          id: '2s',
          label: '2s',
          role: 'primary',
          renderStyle: 'bars',
          color: GREEN,
          opacity: 1,
          lineWidth: 1,
          getValue: radialProbability2s,
        },
      ],
    },
  })
}
