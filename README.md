# LearnQM orbital viewer

Interactive hydrogen-orbital lesson using JavaScript, Three.js and Vite.

## Develop and verify

Use Node 24 (matching CI). Install with `npm ci`, run `npm run dev`, verify with
`npm test` and `npm run build`. The existing development server uses HTTPS for
WebXR and listens on the local network. Follow the existing certificate setup
on each device. GitHub Pages deployment is configured for pushes to `ch1`.

## Controls

| Input | 1s / 2s / 2p |
| --- | --- |
| Horizontal pinch-drag in XR | Rotate the orbital presentation around Y |
| Vertical pinch-drag in XR | Adjust the radial shell |
| Horizontal web drag | Rotate the orbital presentation around Y |
| Vertical web drag | Adjust the radial shell |
| Wheel / two-finger pinch on web | Zoom |
| Existing thumb joystick gesture | Locomotion |
| Open palm toward viewer | Palm menu |
| Opposite index poke | Menu selection |

In 2p, select 2px, 2py or 2pz using the contextual palm-menu row in XR, or the
buttons under the web viewer. Selection preserves inspection yaw and shell
radius. The selected orbital is defined relative to the labeled local axes;
inspection rotates the cloud and axes together. Y rotation leaves the overall
2py lobe shape unchanged. There is no snapping or pitch rotation.

XR pinches start at an 18 mm fingertip gap on the first sample. Release requires
40 mm separation sustained for 100 ms; returning below that gap resets the timer.
Tracking loss still cancels immediately. A pending pinch reserves interaction and
shows origin/endpoint feedback without altering the simulation. After 6 mm of
smoothed motion and a 1.1 dominance ratio, one axis becomes active. To switch,
the other axis must be at least 10 mm from the original pinch, lead the current
axis by 8 mm, and hold that lead for 80 ms. The current axis and its visual stay
selected during confirmation. A noisy sample cannot switch immediately, and an
intentional perpendicular movement is never trapped by a stateful dead zone.
Controls resume from their current value on switching, so they do not jump. Position
smoothing uses a 45 ms time constant, independent of display refresh rate. These
are shared tuning defaults and still need physical Quest/Vision Pro validation.
Web/touch controls retain their original single-axis behavior.

After three seconds without input, web view resumes the existing slow camera
orbit and XR slowly rotates the orbital geometry root. Pointer input immediately
pauses the web camera. Only pinch drag resets the XR idle timer; locomotion and
the palm menu allow idle rotation to continue. Both idle motions use the existing
three-degrees-per-second presentation speed.
The palm menu opens only when all five fingers are extended, the palm faces the
viewer, and neither hand is beginning or holding an interaction. Busy input resets
the opening dwell. Tracking loss requires a fresh pinch. Panel placement defaults
to 5.5 cm above, 2.5 cm toward the viewer and 9 cm toward the fingertips from
the palm anchor. The anatomical finger direction mirrors naturally between hands.

## Structure and extension points

- `src/core/createWebXRApp.js`: renderer, XR lifecycle and input priority.
  Input priority is locomotion, then pinch drag, then palm menu.
  `systems/interaction/updateXRInput.js` coordinates cancellation and ownership.
- `src/systems/interaction/AxisDragControlSystem.js`: recognizes a single owning
  hand and simultaneous horizontal/vertical movement. It accepts horizontal and vertical actions.
- `src/systems/interaction/createOrbitalControls.js`: binds those actions to
  rotation and radius; provides equivalent web callbacks and shared tuning defaults.
- `src/simulations/shared/createOrbitalSimulation.js`: shared point cloud,
  shell, graphs, activity panel, lifecycle and controls for all orbital families.
- `src/simulations/s-orbitals/create1SOrbitalSimulation.js` and
  `create2SOrbitalSimulation.js`: per-simulation settings and distributions.
  The old `createSOrbitalSimulationBase` path remains a compatibility export.
- `src/simulations/p-orbitals/pOrbitalSettings.js`: 2p configuration.
  `OrbitalSelection.js` selects canonical cloud orientation independently of
  its parent inspection transform. `createPOrbitalSimulation.js` adds axes,
  a title and selection controls to the shared simulation.
- `src/systems/navigation/PalmNavigationSystem.js`: palm detection, stable
  placement and action dispatch. `palmPanelPose.js` calculates facing independently
  of wrist roll; `PalmNavigationMenu.js` renders navigation and contextual rows.
- `src/simulations/shared/guidedActivities.js`: single source for web and XR activity text.
- `src/systems/ui/`: reusable coordinate axes, text labels and XR activity panels.

### Simulation configuration

Supply identity and labels, a sample generator, radius range, initial radius,
point/shell appearance, scene scale, graph datasets and graph container ID.
Optional fields include:

- `controls`: override `xrYawRadiansPerMeter`, `webYawRadiansPerPixel`,
  `xrShellFullRangeMeters`, `webShellFullRangePixels`.
- `initialYawRadians`: initial inspection angle (2p starts at zero yaw).
- `graphWorldPosition` / `activityPosition`: positions within the stationary
  simulation root, despite the legacy graph field name. Defaults mirror at
  X = -2.6 / +2.6 m to provide clearance around the orbital.
- `activity`, `activityPanel`: activity content and panel size.
- `graphWidthMeters`, `graphHeightMeters`: graph panel size.

For a different interaction mapping, supply different actions to
`AxisDragControlSystem` and web callbacks through `getWebInteractionProfile()`.
Custom menu choices are supplied through `getMenuActions()` as objects with
`id`, `label`, `kind: 'action'`, `active`, and `onSelect`.

Keep mutable state (radius, selection, current rotation) outside configuration.
The shared simulation accepts a fresh configuration instance and updates its
active graph dataset label when selection changes; do not share graph datasets
between live instances.

## Headset acceptance checklist

1. In 1s and 2s, pinch and move sideways with each hand. Verify Y rotation and
   horizontal marker/line feedback. Move vertically and verify shell/graph response.
2. Pinch and verify immediate pending dots/connector. Move horizontally or vertically
   to choose an action; diagonal motion must not change both values. Verify only the
   selected axis hints appear. Release deliberately and verify the indicator clears.
   Walk/turn with locomotion, stop, then repeat with both hands; check offsets and
   shell response. Turn your head during a drag; direction remains referenced to the original viewer-right basis, while dominant
   displacement can switch the active control.
3. Release, lose tracking or change simulation. Confirm no stuck indicator or
   resumed old drag. During a pinch/drag, raise the opposite open palm: the menu
   must remain closed. Release, then hold all five fingers open to show it.
4. In 2p, select all three orbitals. Check title, active button, graph legend,
   lobe alignment with local axes, and preservation of radius and inspection yaw.
5. Raise either palm at different heights/angles. Verify readable facing, no roll
   flips, and a steady target while the opposite finger approaches and presses.
6. Hold a poke after selection. It must fire only once; withdraw before the next poke.
7. Check graph and activity text while standing at the normal position and after
   locomotion. They should remain stationary relative to the simulation and face
   the viewer horizontally, outside the rotating root.
8. Exit/reenter XR, then scroll between web sections. Check that XR panels disappear,
   the web graph returns, and the 2p selector appears only with the 2p simulation.

### Validation limits

Node tests cover gestures, transform invariants, shell limits, lifecycle,
menu press behavior and panel pose math. Browser checks cover scene rendering,
selection, rotation, shell/graph synchronization, mobile layout and panel textures.
Actual hand tracking, stereo readability, comfort and headset performance require
hardware testing. Panel overlap with the supporting hand is mitigated by placement;
there is no custom per-hand depth compositing. Existing bundle-size and Three.Clock
deprecation warnings remain.

## Presentation and scrolling

The displayed coordinate convention is +X right, +Y up, +Z forward (away from
the initial viewer). Display +Z maps to Three.js -Z; this is a display convention,
not a change to the renderer's right-handed world. The 2pz selection uses the
same direction. The initial web camera is 15 cm above the orbital center; XR
keeps the headset's physical pose. Inspection rotation rotates the labeled frame.

`interfaceTheme.js` defines the shared web/XR color and font roles. Agency is
bundled for titles and prominent values; Arial Narrow is used for instructions,
controls and axes, with Arial fallback on devices without Arial Narrow. Symbols
use Arial for glyph coverage and diagnostic text uses monospace. Bundled fonts
load before canvas textures are drawn. The immersive background is #121212.

Mobile viewer slots reserve their full canvas and control footprint even when
the shared viewer is elsewhere. This adds intentional space in inactive sections,
but relocating the viewer no longer changes document height. Desktop graphs
remain visible in every lesson section. Section fades change opacity only, and
activation has a small hysteresis band to prevent switching back and forth at
section boundaries. Keep these space reservations when changing viewer controls.

The pinch indicator and drag origin use world coordinates again. A locomotion fist cancels pinch dragging and closes the palm menu immediately.
Locomotion cannot be suppressed by a new pinch. Residual motion stops when the
fist releases, before another pinch can start. Each
new pinch captures a fresh origin and viewer-right direction. Feedback retains
the two dots and connector; the active axis also has a faint line between
its direction hints. All feedback uses a transparent overlay group above panels.
Text labels use world-up facing planes rather than camera-aligned sprites, avoiding
head-roll inheritance. XR graphs default to 1.8 × 1.008 m; activity text grows to
fit the existing panel with all steps visible.

System gestures cannot be disabled through a portable WebXR option. Hand tracking
is already requested and the application recognizes joint-based gestures; transient
pointer selection events are not used as a second simulation action path. Keep
pinch drags away from the palm-facing system-menu pose. No session feature or
platform-specific gesture override was added.

### XR camera integrity

Label billboards read the renderer-supplied eye camera `matrixWorld` directly.
Never call `getWorldPosition`, `updateWorldMatrix` or similar camera-updating
helpers on the render callback's camera: XR eye cameras have no rig parent, so
recomputing their world matrix discards the renderer's locomotion transform.
The regression test supplies a translated/rotated XR eye matrix and verifies that
rendering labels preserves both that matrix and its inverse.
