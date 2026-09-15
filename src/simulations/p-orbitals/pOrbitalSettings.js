import { generate2pxSamples, radialProbability2p } from './data/pOrbitalSamplers.js'
import { radialProbability1s, radialProbability2s } from '../s-orbitals/data/sOrbitalDistributions.js'

// Return fresh graph datasets: selected-orbital labels are mutable instance state.
export function createPOrbitalSettings() {
  return {
    id: '2p-orbital', label: '2px', xrMenuLabel: '2p', xrMenuOrder: 3,
    showInXRMenu: true,
    sampleGenerator: ({ maxRadiusA0, ...options }) => generate2pxSamples({ ...options, rMaxA0: maxRadiusA0 }),
    seed: 2202, electronCount: 1000,
    sampleMaxRadiusA0: 12, shellMinRadiusA0: 0.25, shellMaxRadiusA0: 12,
    initialShellOuterRadiusA0: 5.35, shellThicknessA0: 0.25,
    simulationScale: 0.6, webInitialCameraDistance: 2.5,
    a0ToMeters: 0.25, electronRadiusMeters: 0.035, nucleusRadiusMeters: 0.075,
    pointColor: 0xeadfad, pointOpacity: 0.16,
    highlightColor: 0xfff7ae, highlightOpacity: 0.98, shellColor: 0xfff7ae,
    controls: { xrShellFullRangeMeters: 0.18, xrYawRadiansPerMeter: 7 },
    axesLengthMeters: 2.2,
    initialYawRadians: 0,
    desktopGraphContainerId: '2p-orbital-desktop-graph',
    desktopGraphAriaLabel: '2p radial probability graph with 1s and 2s comparisons',
    graphConfig: {
      xMinA0: 0, xMaxA0: 12, yMin: 0, yMax: radialProbability1s(1),
      activeDatasetId: '2p',
      datasets: [
        { id: '1s', label: '1s', role: 'comparison', renderStyle: 'points', color: '#fff7ae', opacity: 0.16, pointRadius: 2, getValue: radialProbability1s },
        { id: '2s', label: '2s', role: 'comparison', renderStyle: 'points', color: '#6ecf7f', opacity: 0.34, pointRadius: 2, getValue: radialProbability2s },
        { id: '2p', label: '2px', role: 'primary', renderStyle: 'bars', color: '#ea9fa2', opacity: 1, lineWidth: 1, getValue: radialProbability2p },
      ],
    },
  }
}
