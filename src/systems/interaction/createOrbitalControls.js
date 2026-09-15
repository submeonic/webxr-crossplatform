import { AxisDragControlSystem } from './AxisDragControlSystem.js'

export const DEFAULT_ORBITAL_CONTROLS = Object.freeze({
  thresholdMeters: 0.012,
  dominanceRatio: 1.2,
  xrYawRadiansPerMeter: 7,
  webYawRadiansPerPixel: 0.008,
  xrShellFullRangeMeters: 0.18,
  webShellFullRangePixels: 260,
})

/** Binding layer: reusable actions with independent XR and web input adapters. */
export function createOrbitalControls({ app, target, getRadius, setRadius,
  minRadius, maxRadius, settings = {} }) {
  const tuning = { ...DEFAULT_ORBITAL_CONTROLS, ...settings }
  let yawStart = 0, radiusStart = 0
  const range = maxRadius - minRadius
  const beginYaw = () => { yawStart = target.rotation.y }
  const beginRadius = () => { radiusStart = getRadius() }
  const changeRadius = value => {
    const radius = setRadius(value)
    return { atMinimum: radius <= minRadius, atMaximum: radius >= maxRadius }
  }
  const xr = new AxisDragControlSystem({
    camera: app.camera,
    indicator: app.pinchDragIndicator,
    thresholdMeters: tuning.thresholdMeters,
    dominanceRatio: tuning.dominanceRatio,
    horizontal: {
      onStart: beginYaw,
      onChange: meters => { target.rotation.y = yawStart + meters * tuning.xrYawRadiansPerMeter },
    },
    vertical: {
      onStart: beginRadius,
      onChange: meters => changeRadius(radiusStart + meters / tuning.xrShellFullRangeMeters * range),
    },
  })
  return {
    xr,
    settings: tuning,
    web: {
      idleCameraOrbit: false,
      horizontalDrag: {
        onStart: beginYaw,
        onChange: ({ totalDeltaX }) => {
          target.rotation.y = yawStart + totalDeltaX * tuning.webYawRadiansPerPixel
        },
      },
      verticalDrag: {
        onStart: beginRadius,
        onChange: ({ totalDeltaY }) => changeRadius(
          radiusStart - totalDeltaY / tuning.webShellFullRangePixels * range),
      },
    },
  }
}
