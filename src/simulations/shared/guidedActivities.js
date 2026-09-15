export const guidedActivities = {
  '1s-orbital': {
    title: 'Explore the 1s orbital',
    steps: [
      'Drag horizontally to rotate the cloud. Does its overall shape change?',
      'Drag vertically to move the shell. Find the radius with the most highlighted measurements.',
      'Compare the highlighted band with the radial graph. Where is its peak?',
      'Move outward from the peak. Describe how the probability changes.',
    ],
  },
  '2s-orbital': {
    title: 'Find the radial node',
    steps: [
      'Move the shell outward from the nucleus. Look for the gap near two Bohr radii.',
      'Rotate the cloud. Is that gap a spherical boundary or a flat plane?',
      'Compare the green 2s curve with the faint yellow 1s curve. Which spreads farther?',
      'Find the inner and outer probability peaks using the shell and graph.',
    ],
  },
  '2p-orbital': {
    title: 'Select, rotate, compare',
    steps: [
      'Choose 2px, 2py, and 2pz using the orbital buttons. In XR, open the palm menu first.',
      'Find the empty nodal plane. Compare it with the labeled X, Y, and Z axes.',
      'Drag horizontally to inspect the cloud and axes together. Your selected orbital stays the same.',
      'Drag vertically to move the shell. Compare the pink radial curve across all three selections.',
      'Compare 2p with 2s. Where does each radial distribution fall to zero?',
    ],
  },
}

export function renderWebActivities() {
  for (const [id, activity] of Object.entries(guidedActivities)) {
    const section = document.querySelector(`[data-simulation="${id}"]`)
    if (!section) continue
    section.querySelector('.guided-activity')?.remove()
    const panel = document.createElement('div')
    panel.className = 'guided-activity'
    const eyebrow = document.createElement('p')
    eyebrow.className = 'eyebrow'
    eyebrow.textContent = 'Guided Activity'
    const heading = document.createElement('h3')
    heading.id = `${id}-activity-title`
    heading.textContent = activity.title
    panel.setAttribute('aria-labelledby', heading.id)
    const list = document.createElement('ol')
    for (const step of activity.steps) {
      const item = document.createElement('li')
      item.textContent = step
      list.append(item)
    }
    panel.append(eyebrow, heading, list)
    section.append(panel)
  }
}
