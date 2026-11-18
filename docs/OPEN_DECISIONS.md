# Orbital viewer: decisions for the next pass

October 21, 2026 backlog. The November 18 persistent panel supersedes the palm-menu initiation and display items below. See the current [UX audit](UX_AUDIT.md).
This is a discussion backlog, not authorization to implement these items.

## Settled and implemented

- Keep radial scanning for s and highest-density probability coverage for p/d.
- Keep the s-only **90% Region** switch. The 2s overlay is one enclosing sphere.
- Plot **probability horizontally, enclosed volume vertically** for p/d. Model
  geometry stays consistent across resampling; measured fractions remain linked
  to the number of revealed outcomes inside that enclosure.
- Use the interactive graph as the web/mobile measurement control; remove the
  redundant probability range slider. Vertical cloud input still works.
- Keep compact web selectors below the desktop viewer and above the mobile
  viewer. On mobile, the viewer and main graph remain adjacent.
- Keep the accelerating measurement reveal on resampling and orbital changes.
- Retain labeled axes without extra transparent nodal planes/cones. Keep the
  existing coverage-driven ring appearance in dz², including smooth emergence.

## Deferred: pitch and the interaction vocabulary

**Decision:** How can every family support yaw and pitch while retaining an easy
measurement interaction? Do not give d a different gesture vocabulary.

Current mapping stays horizontal drag = yaw, vertical drag = measurement. The
existing elevated d camera remains a temporary viewing aid. A two-hand spread
could control measurement or magnification, but those are competing meanings;
neither assignment has been selected. Web and XR may need different mappings,
with clear instruction text for each. Resolve this through simple interaction
trials before changing controls or lesson instructions.

## Deferred: XR hand ownership and gesture conflicts

**Decision:** What evidence starts, retains, cancels, or transfers ownership of
an interaction? Locomotion, pinch drag, menu display, and poking need one explicit
arbitration policy rather than independent accidental triggers.

Discuss intent/confidence, hands in front of the camera versus hands at the
side, dwell, tracking-loss grace, and intentional takeover. A strong intentional
gesture should be able to recover from an accidental gesture without letting a
weak incidental gesture interrupt an intentional one. Exact priorities and
thresholds remain open. No XR gesture or priority behavior changed in this pass.

## Open: scientific scale versus presentation size

**Decision:** Keep one physical-to-display scale across all orbitals, use a
fit-to-view presentation with a visible scale reference, or provide deliberate
magnification?

Currently s/p use simulation scale 0.6; d uses 0.32 and a different desktop
camera setup. Graph units remain physical a₀ / a₀³. On-screen cloud size alone
therefore cannot establish relative physical extent. Discuss a ruler/scale label,
shared-distance reference, and how the same idea should read in VR. Any future
magnification gesture must be distinct in meaning from probability selection.

## Open: a p reference curve on the d volume graph

**Decision:** Add a persistent reference, offer a comparison mode, or keep each
main graph focused on its selected family?

The axis flip makes this easier to read: equal horizontal positions mean equal
probability, so vertical separation means extra required space. A p reference
would sit lower on a common linear volume scale, rather than becoming a narrow
vertical curve. At 90%, the current model volumes are approximately 1,546 a₀³
for 2p, 10,632 for clover-shaped 3d, and 11,954 for 3dz². Evaluate whether the
smaller p curve remains legible, how to label it, and whether this adds enough
insight to justify another series. No reference series was added yet.

## Open: a secondary radial comparison graph

**Proposal:** A noninteractive reference below the main graph, using 1s yellow,
2s green, 2p red, and 3d blue on a common distance scale.

Decide whether it is always present, its space cost on mobile, the distance
range, and whether the curves share absolute probability-density scaling.
Call it *radial probability density*, not local spatial density: it sums over
all directions and remains meaningful for p/d, while intentionally discarding
their angular shape. One radial curve per family/state is sufficient for the
orientation choices. It could explain physical extent, but does not by itself
resolve the viewer’s display scale or VR magnification policy. Not implemented.

## Open: remaining web polish and acceptance

- The separate slider question is resolved: it is removed. Review the compact
  selector / Resample arrangement in use before deciding on further changes.
- Very short landscape viewports cannot always show the full viewer and graph
  together at readable sizes. Decide whether they need a dedicated layout.
- Test on physical Quest and Vision Pro: hand priority failures, palm-menu
  initiation, stereo enclosure transparency, text size, reach, and frame times.
  Browser and automated checks do not settle these points.
- After the next interaction/scale decisions, audit all menu paths and revise
  tutorial, lesson, guided-activity, and accessible control text together.
