export const guidedActivities = {
  '1s-orbital': {
    title: 'Where does the shell catch the most dots?',
    steps: [
      'Start with the smallest shell. How many dots does it catch near the dense center?',
      'Move to the graph peak, then farther out. How do shell size and dot spacing explain the rise and fall?',
      'Keep the shell still and resample. Which changes more, the count or the location of the peak?',
    ],
  },
  '2s-orbital': {
    title: 'Trace the gap around the nucleus',
    steps: [
      'Scan across both peaks. At what radius does the green curve touch zero between them?',
      'Turn the cloud with the shell at that radius. What shape would the gap have in a slice through the center?',
      'Switch on 90% Region. Where do you still see dots outside the sphere?',
    ],
  },
  '2p-orbital': {
    title: 'Follow the two lobes',
    steps: [
      'Switch from 2px to 2py. Which way must you look to see the gap edge-on?',
      'Set the enclosure to 50%. Which directions does its surface follow as you grow it to 90%?',
      'Compare the volume added from 20% to 30% with that from 80% to 90%. What do the outer dots tell you about the difference?',
    ],
  },
  '3d-orbital': {
    title: 'Find the ring',
    steps: [
      'Turn 3dxy, then select 3dx²−y². Which lobes point along the axes?',
      'Select 3dz². Start at 20% and grow the enclosure. When does its surface first wrap around the ring?',
      'Stop near the ring marker and resample. What changes in the yellow graph points? What happens to the surface?',
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
