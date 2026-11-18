# Orbital feature update: UX and content audit

## November 18, 2026 · persistent XR navigation and shorter lesson

The lower-left panel is available on the first tracked viewer frame, including
when neither hand is visible. Either index finger can press a button. The eye
dims the backing and controls to 15%; while dimmed only the eye accepts a poke.
A front approach arms a button and a held finger activates it once. Losing
tracking, changing hands or engaging locomotion or pinch clears the press.

The panel is attached to the rig, follows tracked eye height, and tilts toward the
viewer. Head rotation alone leaves it still. Initial facing, horizontal walking
in 18 cm increments, and starting forward locomotion establish the heading.
This approximates body direction from available tracking. A sideways step can
therefore reorient the panel. Reach, comfort while leaning, rapid hand motion,
and stereo legibility at 15% still need trials with seated and standing users.

Automated checks exercised both index fingers, dim and restore, suspended
pokes, loss of hand tracking, room-scale travel, rig turns, glance stability
and session reset. Desktop Chrome at widths of 1280, 390, and 320 pixels
displayed all four lessons and their three prompts, kept the viewer with its
section on mobile, and accepted graph keyboard input, orbital selection and
resampling. The page fit each viewport horizontally.

The s lessons ask students to compare equal-thickness shells at different
radii. The 2p lesson uses equal-radius points in different directions to
introduce enclosures and the volume graph. The 3d activity asks students to
locate the ring themselves. Web and XR use the same activity text.

## Earlier review


Reviewed October 21, 2026. Scope: desktop, touch/mobile, graph input, orbital
selection, measurement accumulation, immersive menu layout/state, and all lesson
and guided-activity content. This records software/browser checks; it does not
claim physical headset acceptance. The initial feature-pass record follows; the
follow-up section at the end records the later agreed refinements.

## Changes resulting from the review

- Kept radial scanning and the Region switch exclusive to s. The 2s Region overlay
  is now one 90% sphere; it is labeled separately from the thin scanning shell.
- p/d have one probability selection, shared by vertical input, graph dragging,
  keyboard adjustment, the slider, geometry, highlighting, and quantitative
  readouts. Off is explicit; active coverage starts at 5%, initially 90%.
- The main p/d graph quantifies probability and measured fraction versus enclosed
  volume. It has physical a₀³ units, 50%/90% guides, model/measurement distinctions,
  and a dz² ring-appearance marker. Full 2D slices and comparison modes were not
  added. Increased graph annotation/readout sizes after narrow-phone review.
- Made the d camera start above the orbital plane, avoiding an initially edge-on
  view of dxy. The lesson discloses the smaller d display scale.
- Put orbital choices above the probability/action row on the web. The five d
  choices use three columns and two rows; Resample never squeezes their labels.
- XR has fixed family tabs and a fixed Resample / Exit XR footer. Choices retain
  existing target dimensions; Region appears only for s. Entire page replacement
  waits for finger withdrawal, so tab changes cannot trigger a new underlying
  button while the finger is still pressing.
- Graphs now expose focusable slider semantics, numeric accessible values, and
  arrows/Home/End. Camera keyboard handling yields to graph/form input.
- Kept XR availability separate from the active-orbital/measurement label.
- Mobile chapter link scrolls away instead of floating over viewer controls.
- Mobile inactive slots reserve the complete family-specific control height;
  removing or inserting the shared viewer cannot change page height.
- Resampling and every different orbital activation reveal independent outcomes
  over about three seconds. Counts, highlights, and observed fractions include
  only revealed outcomes. Re-selecting the current orbital does not restart.
  Reduced-motion preferences skip accumulation; background time cannot finish it.
- Boundary shapes and model curves remain unchanged during resampling. Ring
  appearance uses its own keyframe rather than morphing unrelated components.
  Only neighboring frame buffers remain cached during dragging.

## Content review

Updated the index introduction/tutorial, p lesson, new d lesson, shared web/XR
activities, viewer hints, graph labels and accessible text, and README.

The revised copy distinguishes spatial density from radial probability density,
probability from finite-sample fractions, cumulative enclosures from thin shells,
and independent measurement outcomes from trajectories. It explains that the
percentage covers all components together, nodes remain zero-density surfaces,
and the enclosure is not a physical orbital edge. The d activity connects the
29.8% threshold to emergence of the equatorial enclosure; the ring already exists
in the underlying orbital. No phase/charge color interpretation is introduced.
The reveal's acceleration is explicitly presentation timing, not a physical rate.

## Browser and automated checks

- Browser rendering and interactions checked at desktop 1280×900 and phone
  viewports 390×844 and 320×740. Checked d selection, dz², slider Off/5%/29%, and
  graph keyboard selection. No horizontal overflow; narrow-phone orbital and
  Resample buttons retained 44px height.
- At the 320px viewport, moving the viewer through s, p and d kept document height
  exactly 11,351px in the audited build. Reserved slot heights remained unchanged
  before/after movement. Selection/coverage changes also kept that height stable.
- Observed model and measured points together on the desktop graph and verified
  empty/revealing/completed count readouts. Browser logs contained only the
  existing Three.js Clock deprecation warning, with no application errors.
- Node tests cover independent sample-frequency agreement, d angular moments,
  preserved radial samples, untruncated d tails, monotone/invertible volume
  selection, enclosure density and volume accuracy between keyframes, and
  continuous ring appearance. Lifecycle tests verify only revealed outcomes
  count, replay/reset behavior, resample state preservation, menu bounds, fixed
  footer positions and tab replacement after withdrawal.
- Existing gesture-priority, camera-matrix, idle-motion and cancellation tests
  remain in the suite. The production build succeeds with the known bundle-size
  warning.

## Physical headset acceptance still required

Quest and Vision Pro: verify stereo transparency and node gaps, label readability,
menu reach/comfort with each hand, poke withdrawal across every family, selection
while moving, XR exit/re-entry, and frame times while scrubbing coverage near the
ring event and during the final accelerated reveal. Automated geometry and menu
checks do not establish hand-tracking quality or headset GPU performance.

## Follow-up refinement: October 21, 2026

This section supersedes the initial layout/axis/slider descriptions above.

- Transposed the p/d graph: probability and measured fraction are horizontal;
  enclosed volume is vertical. A steeper model curve now means more space is
  needed for the next portion of probability. Updated lesson/activity copy,
  labels, accessible names, and graph pointer mapping together. Sampling
  discrepancies move measured points horizontally at the same enclosure volume.
- Removed the separate web/mobile probability slider. The graph retains direct
  horizontal selection, keyboard arrows/Home/End, Off, and the 5–90% active range.
  Vertical cloud input and XR measurement gestures retain their existing mapping.
- Compact web selectors use label-sized widths and at least 44px touch targets.
  Desktop actions remain below the viewer. On mobile the existing controls move
  above it; the viewer and graph have only a 4px gap between them. No controls or
  hints occupy that gap. Inactive control and viewer slots reserve their heights.
- Corrected a grid sizing issue exposed by resizing from 320px to 390px: the
  canvas now fills the available viewer width rather than keeping its former
  narrower width. The gap measurement uses the actual canvas edge.
- Renamed the s web switch and XR action to **90% Region**, with matching lesson
  and guided-activity text. No XR gesture, hand priority, or pitch changes.
- Browser checks at 1280×900, 390×844, and 320×740 confirmed desktop placement,
  mobile control ordering, no horizontal overflow, and compact 44px-high choices.
  At 390px the 343px canvas matches the viewer width and ends 4px before the graph.
  At 320px all five d choices fit one row; moving between d, p, and s kept document
  height fixed at 11,211px. Verified Off → 5% keyboard selection, direct graph
  pointer selection, and the visible 90% Region label.
- Added regression checks for transposed model/measurement coordinates and
  probability input, plus responsive node movement, focus retention, and XR
  deferral. The full test suite and production build pass; the known large-bundle
  warning remains. Physical headset acceptance is still outstanding.

See [open decisions](OPEN_DECISIONS.md) for pitch, XR arbitration, scale policy,
reference plots, and later usability work.
