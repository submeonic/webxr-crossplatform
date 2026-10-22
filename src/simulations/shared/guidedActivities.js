export const guidedActivities = {
  '1s-orbital': {
    title: 'From cloud to graph',
    steps: [
      'Predict the view after rotation. Turn the cloud to test its spherical symmetry.',
      'Scan outward. Find the shell containing the most highlighted outcomes.',
      'Why is the peak near 1 a₀, not the center? Consider each shell’s size.',
      'Turn on 90% Region: its single sphere encloses 90% probability, not a hard edge. Resample: does the shell count repeat exactly?',
    ],
  },
  '2s-orbital': {
    title: 'Map a spherical node',
    steps: [
      'Scan outward. Find the inner cluster, the zero near 2 a₀, and the broad outer region.',
      'Move the measuring shell away, then rotate. Does the empty gap surround the nucleus?',
      'Compare 2s with the faint 1s reference. Which extends farther?',
      'Turn on 90% Region. Its single 90% sphere surrounds both clusters; the node remains inside. Resample and watch independent outcomes accumulate.',
    ],
  },
  '2p-orbital': {
    title: 'How much space captures probability?',
    steps: [
      'Switch among 2px, 2py, and 2pz. Which axis contains each pair of lobes?',
      'Drag across the graph or vertically on the cloud to shrink and grow the enclosure. Its percentage is shared by both lobes; highlighted outcomes are inside.',
      'Compare the extra volume needed from 20% to 30% and from 80% to 90%. What does the curve’s changing slope mean?',
      'Resample. Watch measured fractions approach the steady model. Why do repeated sample counts differ?',
    ],
  },
  '3d-orbital': {
    title: 'Find where a new region appears',
    steps: [
      'Select the four clover-shaped orbitals. Rotate their axes: which lobes lie along axes, and which lie between them?',
      'Select 3dz². Lower coverage below 30%, then increase it slowly. The equatorial ring begins near 29.8%; find the graph marker.',
      'From 80% to 90%, how much volume must the enclosure add? Relate the steeper curve to less-dense space.',
      'Resample at a fixed coverage. The shape and model stay steady while highlighted counts fluctuate. Each dot is a separate outcome.',
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
