# LearnQM orbital viewer

An interactive hydrogen-orbital lesson built with JavaScript, Three.js, WebXR,
and Vite. The page connects three representations of the same probability
distribution:

- a seeded 3D point cloud of possible electron measurements;
- a constant-thickness spherical shell that selects points by radius; and
- a radial-probability graph synchronized with that shell.

The experience is designed for desktop, touch devices, and immersive hand-tracked
XR. The scientific and interaction intent is instructional: students rotate the
spatial distribution, scan it by radius, and compare what changes with what stays
invariant.

## Implemented simulations

| Simulation | Spatial feature | Radial graph |
| --- | --- | --- |
| 1s | Spherically symmetric cloud with no node | Active 1s distribution |
| 2s | Inner and outer regions separated by a spherical radial node at 2 a₀ | Active 2s distribution with a faint 1s reference |
| 2p | Two lobes separated by a nodal plane; selectable 2px, 2py, and 2pz orientations | Active 2p distribution with faint 1s and 2s references |

Each simulation currently uses 1,000 deterministic samples. Seeds and visual
settings live in the simulation factories. All three use a shell range of
0.25–12 a₀, an initial outer radius of 5.35 a₀, and a shell thickness of 0.25 a₀.
The graph shows the analytic radial distribution while the count above it reports
how many sampled points lie inside the selected shell.

Changing a 2p orientation rotates the existing canonical 2px sample cloud. It
does not regenerate samples, change sample radii, reset the shell, or reset the
user's inspection rotation. This is intentional: orientation changes angular
probability but not the radial distribution.

## Develop, test, and deploy

Use Node 24, matching CI:

```sh
npm ci
npm run dev
npm test
npm run build
```

The development server uses HTTPS and listens on the local network because WebXR
requires a secure context. Follow the local `vite-plugin-mkcert` certificate setup
on each test device. The production base path is `/webxr-crossplatform/`.

GitHub Pages deployment is configured in `.github/workflows` for pushes to `ch1`
and manual workflow dispatch. It installs with `npm ci`, builds `dist`, and deploys
that directory.

## User controls

### Desktop and touch

| Input | Result |
| --- | --- |
| Horizontal mouse, pen, or one-finger drag | Rotate the orbital presentation around displayed Z |
| Vertical mouse, pen, or one-finger drag | Scan the radial shell |
| Drag directly on the radial graph | Set the shell radius from the graph position |
| Mouse wheel | Dolly the camera |
| Two-finger pinch/stretch | Dolly the camera |
| W/S or Up/Down | Dolly the camera |
| A/D or Left/Right | Orbit the camera |

A one-pointer gesture remains pending until it moves 8 pixels, then locks to the
dominant horizontal or vertical axis. Multi-pointer gestures must fully release
before a new one-pointer gesture can begin, preventing jumps when a pinch ends.
Pointer loss, window blur, or page visibility loss cancels active web input.

The simulation-specific web interaction profile owns horizontal and vertical
drag. Pinch, wheel, and keyboard input remain camera controls. After two seconds
without web input, the camera resumes a 5°/s orbit around the active simulation.
The 2p simulation adds 2px, 2py, and 2pz buttons below the web viewer; the same
choices appear as contextual actions in the XR palm menu.

### Immersive XR

| Gesture | Result |
| --- | --- |
| Pinch, then move sideways | Rotate the orbital presentation around displayed Z |
| Pinch, then move vertically | Scan the radial shell |
| Fist/thumb D-pad gesture | Locomotion and turning |
| Open palm facing the viewer | Open the navigation menu |
| Opposite index-finger poke | Activate a menu item |

The XR input priority is strict:

1. locomotion;
2. pinch drag;
3. palm menu.

Locomotion cancels an active pinch and closes the palm menu. A pending or active
pinch prevents the menu from opening. Tracking loss cancels the current pinch,
and every new pinch captures a fresh world-space origin and viewer-right basis.

Pinch detection starts on the first sample at or below an 18 mm thumb/index gap.
Release requires a gap of at least 40 mm sustained for 100 ms. The axis-drag
state machine uses these shared defaults:

| Setting | Value |
| --- | ---: |
| Motion threshold | 6 mm |
| Initial dominance ratio | 1.1 |
| Perpendicular-switch activation | 10 mm |
| Perpendicular lead over active axis | 8 mm |
| Switch hold time | 80 ms |
| Position smoothing time constant | 45 ms |
| Full shell-range drag | 18 cm |

Only one hand owns a pinch. The active axis can switch when perpendicular intent
is sustained, but the newly selected control resumes from its current value so
rotation or shell radius does not jump. The indicator shows the pinch origin and
smoothed endpoint immediately, then adds direction hints and a guide line after
axis selection. Limit feedback is passed through when the shell reaches its range.

After three seconds without a pinch, XR slowly rotates the orbital geometry root
at 3°/s. Locomotion and an open menu do not reset this timer; a pinch does.

The palm menu accepts either open hand, uses the other index finger for poking,
and exposes simulation navigation plus contextual actions such as the 2p
orientation row. Its pose ignores wrist roll, limits panel tilt, mirrors the
anatomical finger direction between hands, and freezes while the opposite finger
approaches. The configured open-palm dwell is 250 ms with 180 ms tracking grace;
the enter/exit curl thresholds are 0.18/0.28 and the facing threshold is 30°.
Placement is 5.5 cm up, 2.5 cm toward the viewer, and 9 cm toward the fingertips,
with 20° maximum tilt. Buttons wait 400 ms after opening before activation. A held
poke fires only once and must withdraw before another press.

## Coordinate convention

The labels shown to learners use:

- +X right;
- +Y forward, away from the initial viewer; and
- +Z up.

This is a presentation convention, not a change to Three.js world space. Display
+Y maps to Three.js −Z, while display +Z maps to Three.js +Y. The shared mapping
is defined in `src/systems/ui/displayCoordinateSystem.js` and is consumed by both
the coordinate-axis renderer and p-orbital selection. Do not duplicate or
special-case this mapping in a simulation.

The canonical p cloud points along +X. `OrbitalSelection.js` uses the shared
display mapping to derive the quaternion for 2px, 2py, or 2pz. The labeled axes
and point cloud are children of the same rotating visualization root, so
inspection always rotates them together.

## Runtime architecture

`src/main.js` creates every simulation once, registers navigation metadata,
starts the responsive placement and scroll controllers, and then starts the app
animation loop.

`src/core/createWebXRApp.js` owns shared platform services:

- Three.js scene, renderer, camera, lighting, and player rig;
- WebXR session lifecycle and availability UI;
- desktop orbit/dolly controls and web pointer routing;
- hand models, pinch tracking, locomotion, palm navigation, and debug systems;
- active-simulation switching, update dispatch, resizing, and disposal.

All orbital families are built on
`src/simulations/shared/createOrbitalSimulation.js`. Its important scene hierarchy
is:

```text
simulation group
└── stationary presentation root
    ├── content anchor
    │   └── rotating/scaled orbital root
    │       ├── point cloud
    │       ├── nucleus
    │       ├── inner and outer shell meshes
    │       └── p-only labeled coordinate axes
    ├── XR radial graph panel
    └── XR guided-activity panel
```

Only the orbital root receives inspection rotation and simulation scale. XR graph
and activity panels remain stationary relative to the simulation presentation so
they stay readable while the atom rotates. The desktop camera orbits the
presentation root around the content-height offset.

Every simulation exposes a common lifecycle and state API:

- `enter()` / `exit()` control visibility and reset transient XR input;
- `update(deltaTime, context)` updates XR-only panels and idle motion;
- `handleInput()` routes XR interaction to the active simulation;
- `getWebInteractionProfile()` supplies simulation-aware web gestures;
- `getShellState()` and `setShellOuterRadiusA0()` expose shell state;
- `getSamples()` exposes the fixed sample set for verification;
- `getMenuActions()` optionally supplies contextual palm-menu actions;
- `dispose()` releases geometries, materials, textures, graphs, and listeners.

Simulation changes reset active pinch state before the previous simulation exits.
Scrolling on the webpage resets desktop framing for the newly active simulation.
XR palm-menu navigation preserves the player's physical rig transform. Starting
an XR session resets the rig once while preserving the selected simulation;
ending XR resets XR interaction systems and restores predictable desktop framing.

## Shared shell and graph state

`setShellOuterRadiusA0()` is the single mutation path for shell selection. It:

1. clamps the outer radius;
2. derives the inner radius from constant shell thickness;
3. scales both Fresnel shell meshes;
4. recomputes highlighted sample count; and
5. updates the desktop graph and XR graph from the same state object.

Keep new controls routed through this method so the 3D highlight, count, graph
selection line, and XR panel cannot diverge.

The graph renderer in `drawRadialGraph.js` is shared by the responsive HTML canvas
and the XR canvas texture. Active datasets use bars; comparison datasets use
faint point traces. All current graphs share the 1s peak as their y maximum so
cross-orbital visual comparisons remain meaningful. The desktop graph is directly
interactive; the XR graph is presently display-only.

Guided activities have one source in `guidedActivities.js`. The same title and
steps are rendered into the web lesson and the XR activity panel.

## Interface theme and XR panels

`src/systems/ui/interfaceTheme.js` is the shared source for web and canvas-based
XR color and font roles. Agency FB is bundled for display text; Arial Narrow with
Arial fallback is used for instructions, axes, and controls. Symbol text uses
Arial for glyph coverage and diagnostic text uses monospace. The app waits for
both Agency weights before creating simulations because canvas textures do not
redraw automatically when a web font finishes loading.

The immersive background is `#121212`. XR graph panels default to 1.8 × 1.008 m.
Guided-activity text reduces its font size as needed to keep all configured steps
inside the panel. Graph and activity panels face the viewer horizontally rather
than inheriting headset roll.

## Responsive presentation and scrolling

The page uses three layout modes:

- above 1100px: full two-column lesson with a sticky shared viewer;
- 761–1100px: compact two-column layout;
- 760px and below: single-column layout where the same viewer DOM node moves into
  the active lesson section.

`ScrollSimulationController` selects the section nearest the viewport center.
The active section receives a ±24px activation-line hysteresis band to avoid
rapid switching at boundaries. `ResponsiveViewerPlacementController` moves the
single viewer between the desktop slot and matching `data-viewer-slot`; it defers
DOM movement while XR is presenting and resizes the renderer after placement.

Mobile layout has a strict no-jump contract. Every lesson section reserves the
compact height its viewer will need even while the shared viewer is elsewhere:

- the 4:3 canvas plus label and hint in every section;
- an additional 56px selector row only for 2p;
- an additional 60px XR-button row only when XR is available;
- 64px of standard label/hint chrome, increased to 108px at 450px and below
  where the viewer label wraps.

These reservations are defined by CSS custom properties on `.mobile-viewer-slot`.
Do not collapse inactive slots: releasing space above the scroll position causes
the page to jump when the viewer moves. Adjust the reserved variables whenever a
new persistent mobile viewer control is added. The graph follows the reserved
viewer area with a 32px gap at current mobile gutters.

## Simulation configuration

The shared factory validates these required fields:

- `id`, `label`;
- `sampleGenerator`, `sampleMaxRadiusA0`;
- `shellMaxRadiusA0`, `initialShellOuterRadiusA0`;
- `pointColor`, `highlightColor`, `shellColor`;
- `desktopGraphContainerId`, `graphConfig`.

Common optional fields include:

- sample state: `seed`, `electronCount`, `a0ToMeters`;
- shell state: `shellMinRadiusA0`, `shellThicknessA0`, Fresnel alpha/power;
- appearance: point opacity, highlight opacity, electron/nucleus size;
- presentation: `simulationScale`, `contentHeight`, `presentationOffset`,
  `initialYawRadians`, `webInitialCameraDistance`;
- XR panels: graph/activity positions and sizes, activity content and panel options;
- controls: `xrFullRangeDragDistanceMeters`, `webShellFullRangeDragPixels`, or
  overrides under `controls`;
- XR idle motion: delay and angular speed;
- navigation metadata: menu label, order, and visibility.

Graph configuration supplies axis bounds, the active dataset ID, and dataset
objects containing identity, label, role, render style, color, opacity, and a
`getValue(radiusA0)` function. Return fresh configuration and dataset objects for
each live simulation: 2p mutates its active dataset label when orientation changes.

Keep mutable state—radius, selection, and current rotation—outside shared config
objects. Selection changes should transform a child such as `pointCloudRoot`, not
overwrite the parent inspection rotation.

## Adding another simulation

1. Add the lesson section, matching `data-simulation`, `data-viewer-slot`, and
   desktop graph container to `index.html`.
2. Add the sampler/distribution and a factory that calls
   `createOrbitalSimulation()` or the s-orbital compatibility wrapper.
3. Register the instance and navigation metadata in `src/main.js`.
4. Add the guided activity to `guidedActivities.js`.
5. If it adds persistent mobile controls, update the reserved slot height rather
   than allowing active and inactive layouts to differ.
6. If it adds contextual XR actions, implement `getMenuActions()` with objects
   containing `id`, `label`, `kind: 'action'`, `active`, and `onSelect`.
7. Add tests for lifecycle, state preservation, transform invariants, and any new
   interaction behavior.

## Important implementation constraints

- Text labels are world-up planes, not camera-aligned `THREE.Sprite` objects, so
  head roll does not tilt instructional text.
- XR billboards read the renderer-supplied eye camera `matrixWorld` directly.
  Never call `getWorldPosition()`, `updateWorldMatrix()`, or another matrix-updating
  helper on the render callback's XR eye camera; doing so can discard locomotion
  because XR eye cameras do not carry the player-rig parent.
- System gestures cannot be disabled through a portable WebXR option. Keep custom
  pinches away from the platform palm-facing system-menu pose.
- Joint-based gestures are the only XR simulation-action path. Transient pointer
  selection events are not also routed into the simulation.
- The point-cloud and labeled axes belong inside the rotating root; graphs and
  instructional panels do not.
- Shared graph datasets must not be reused between live configurations because
  selected-orbital labels are mutable instance state.

## Verification

Automated Node tests cover:

- pinch-axis recognition, switching, and value continuity;
- input priority and cancellation;
- shell limits and graph synchronization;
- 2p transform and selection invariants;
- idle-motion timing;
- simulation lifecycle and disposal;
- palm eligibility, pose math, poke locking, and menu layout;
- XR camera-matrix integrity while rendering labels.

Run both `npm test` and `npm run build` before merging. The build currently emits
an existing large-chunk warning, and Three.js emits an existing `THREE.Clock`
deprecation warning.

Browser checks should cover scene rendering, graph dragging, shell/highlight
synchronization, responsive placement, stable mobile document height, and the 2p
selector. Actual hand tracking, stereo readability, comfort, system-gesture
competition, and headset performance still require physical Quest and Vision Pro
testing.

### Headset acceptance checklist

1. Pinch sideways and vertically with each hand. Verify only one action changes,
   axis hints match it, and switching axes does not jump.
2. Verify deliberate release, tracking loss, locomotion, and simulation changes
   leave no stuck pinch indicator or resumed old drag.
3. Attempt to open the palm menu during locomotion and pinch. It must remain closed;
   after release, either open palm should work.
4. Select 2px, 2py, and 2pz. Check the title, active control, graph legend, displayed
   axis alignment, radius preservation, and inspection-rotation preservation.
5. Open the menu at different heights and wrist angles. Check facing, tilt, mirrored
   hand behavior, approach freeze, single-fire poke, and withdrawal reset.
6. Move with locomotion and confirm graph/activity panels remain stationary relative
   to the simulation, outside the rotating orbital root.
7. Exit and re-enter XR, then scroll among web sections. Confirm XR panels hide,
   desktop graphs remain available, the correct mobile slot receives the viewer,
   and the page does not jump when the viewer moves.
