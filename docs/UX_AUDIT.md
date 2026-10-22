# Orbital feature update: UX and content audit

Reviewed October 21, 2026. Scope: desktop, touch/mobile, graph input, orbital
selection, measurement accumulation, immersive menu layout/state, and all lesson
and guided-activity content. This records software/browser checks; it does not
claim physical headset acceptance.

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
