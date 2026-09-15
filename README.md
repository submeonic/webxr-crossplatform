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

XR drags have a 12 mm activation threshold and a dominant-axis lock that lasts
until release. Horizontal direction is captured from the viewer at pinch start.
The palm menu interrupts active drags, and tracking loss requires a fresh pinch.

## Structure and extension points

- `src/core/createWebXRApp.js`: renderer, XR lifecycle and input priority.
  Existing priority remains palm menu, then simulation interaction, then hand locomotion.
- `src/systems/interaction/AxisDragControlSystem.js`: recognizes a single owning
  hand and a locked drag direction. It accepts horizontal and vertical actions.
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

- `controls`: override `thresholdMeters`, `dominanceRatio`,
  `xrYawRadiansPerMeter`, `webYawRadiansPerPixel`,
  `xrShellFullRangeMeters`, `webShellFullRangePixels`.
- `initialYawRadians`: initial inspection angle (2p starts slightly turned to show its axes).
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
2. Start diagonally, then commit to an axis. Confirm the other action stays still
   until release. Turn your head during a horizontal drag; its direction should not jump.
3. Release, lose tracking, change simulation, or open the palm menu mid-drag.
   Confirm no stuck indicator, camera movement or resumed old drag.
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
