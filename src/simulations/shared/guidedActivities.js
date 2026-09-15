export const guidedActivities = {
  '1s-orbital': {
    title: 'From cloud to graph',
    steps: [
      'Predict the view after rotation. Turn the cloud to test its spherical symmetry.',
      'Scan outward. Find the shell containing the most highlighted outcomes.',
      'Why is the peak near 1 a₀, not the center? Consider each shell’s size.',
      'Scan past the peak. Do you find a sharp edge or a fading probability tail?',
    ],
  },
  '2s-orbital': {
    title: 'Map a spherical node',
    steps: [
      'Scan outward. Find the inner cluster, the zero near 2 a₀, and the broad outer region.',
      'Move the measuring shell away, then rotate. Does the empty gap surround the nucleus?',
      'Compare 2s with the faint 1s reference. Which extends farther?',
      'Explain how the node divides 2s into inner and outer probability regions.',
    ],
  },
  '2p-orbital': {
    title: 'Separate direction from radius',
    steps: [
      'Switch among 2px, 2py, and 2pz. Which axis contains each pair of lobes?',
      'Predict the nodal plane, then rotate the cloud and axes to check it.',
      'Scan, then switch orientation. What changes in 3D but not on the graph?',
      'Compare 2p’s nodal plane with 2s’s spherical node.',
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
