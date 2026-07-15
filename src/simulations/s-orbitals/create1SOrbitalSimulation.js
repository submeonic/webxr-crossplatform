import { createSOrbitalSimulationBase } from './createSOrbitalSimulationBase.js'
import { radialProbability1s } from './data/sOrbitalDistributions.js'
import { generate1sSamples } from './data/sOrbitalSamplers.js'

const YELLOW = '#fff7ae'
const SHARED_GRAPH_Y_MAX = radialProbability1s(1)

export function create1SOrbitalSimulation(app) {
  return createSOrbitalSimulationBase(app, {
    id: '1s-orbital',
    label: '1s',

    xrMenuLabel: '1s',
    xrMenuOrder: 1,
    showInXRMenu: true,

    sampleGenerator: generate1sSamples,
    seed: 1005,
    electronCount: 2000,

    sampleMaxRadiusA0: 5,
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
    pointColor: 0xeadfad,
    pointOpacity: 0.16,
    highlightColor: 0xfff7ae,
    highlightOpacity: 0.98,
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
          renderStyle: 'bars',
          color: YELLOW,
          opacity: 1,
          lineWidth: 1,
          getValue: radialProbability1s,
        },
      ],
    },
  })
}
