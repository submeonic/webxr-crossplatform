import { AxisDragControlSystem } from './AxisDragControlSystem.js'

export const DEFAULT_ORBITAL_CONTROLS = Object.freeze({
  thresholdMeters: 0.006,
  dominanceRatio: 1.1,
  switchActivationMeters: 0.010,
  switchMarginMeters: 0.008,
  switchHoldSeconds: 0.08,
  xrYawRadiansPerMeter: 7,
  webYawRadiansPerPixel: 0.008,
  xrShellFullRangeMeters: 0.18,
  webShellFullRangePixels: 260,
})

/** Binding layer: reusable actions with independent XR and web input adapters. */
export function createOrbitalControls({ app, target, getRadius, setRadius,
  minRadius, maxRadius, getValue = getRadius, setValue = setRadius,
  minimum = minRadius, maximum = maxRadius, settings = {} }) {
  const tuning = { ...DEFAULT_ORBITAL_CONTROLS, ...settings }
  let yawStart = 0, selectionStart = 0
  const range = maximum - minimum
  const beginYaw = () => { yawStart = target.rotation.y }
  const beginSelection = () => { selectionStart = getValue() }
  const changeSelection = value => {
    const selected = setValue(value)
    return { atMinimum: selected <= minimum, atMaximum: selected >= maximum }
  }
  const xr = new AxisDragControlSystem({
    camera: app.camera,
    indicator: app.pinchDragIndicator,
    thresholdMeters: tuning.thresholdMeters,
    dominanceRatio: tuning.dominanceRatio,
    switchActivationMeters: tuning.switchActivationMeters,
    switchMarginMeters: tuning.switchMarginMeters,
    switchHoldSeconds: tuning.switchHoldSeconds,
    horizontal: {
      onStart: beginYaw,
      onChange: meters => { target.rotation.y = yawStart + meters * tuning.xrYawRadiansPerMeter },
    },
    vertical: {
      onStart: beginSelection,
      onChange: meters => changeSelection(selectionStart + meters / tuning.xrShellFullRangeMeters * range),
    },
  })
  return {
    xr,
    settings: tuning,
    web: {
      idleCameraOrbit: true,
      horizontalDrag: {
        onStart: beginYaw,
        onChange: ({ totalDeltaX }) => {
          target.rotation.y = yawStart + totalDeltaX * tuning.webYawRadiansPerPixel
        },
      },
      verticalDrag: {
        onStart: beginSelection,
        onChange: ({ totalDeltaY }) => changeSelection(
          selectionStart - totalDeltaY / tuning.webShellFullRangePixels * range),
      },
    },
  }
}
