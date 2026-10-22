import { generate2pxSamples } from './data/pOrbitalSamplers.js'

// Return fresh graph datasets: selected-orbital labels are mutable instance state.
export function createPOrbitalSettings() {
  return {
    id: '2p-orbital', label: '2px', xrMenuLabel: '2p', xrMenuOrder: 3,
    showInXRMenu: true,family:'p',measurementMode:'coverage',coverageType:'2p',
    sampleGenerator: ({ maxRadiusA0, ...options }) => generate2pxSamples({ ...options, rMaxA0: maxRadiusA0 }),
    seed: 2202, electronCount: 1000,
    sampleMaxRadiusA0: Infinity, shellMinRadiusA0: 0.25, shellMaxRadiusA0: 12,
    initialShellOuterRadiusA0: 5.35, shellThicknessA0: 0.25,
    simulationScale: 0.6, webInitialCameraDistance: 2.5,
    a0ToMeters: 0.25, electronRadiusMeters: 0.035, nucleusRadiusMeters: 0.075,
    pointColor: 0xeadfad, pointOpacity: 0.16,
    highlightColor: 0xfff7ae, highlightOpacity: 0.98, shellColor: 0xfff7ae,
    regionColor: 0xea9fa2, regionRimColor: 0xfff7ae,
    controls: { xrShellFullRangeMeters: 0.18, xrYawRadiansPerMeter: 7 },
    axesLengthMeters: 2.2,
    initialYawRadians: 0,
    desktopGraphContainerId: '2p-orbital-desktop-graph',
    desktopGraphAriaLabel: '2p enclosed volume versus probability and measured fraction; drag horizontally or use arrow keys',
    graphConfig: {kind:'coverage'},
  }
}
