import { createOrbitalSimulation } from '../shared/createOrbitalSimulation.js'
import { createPOrbitalSettings } from './pOrbitalSettings.js'
import { P_ORBITALS, selectOrbitalOrientation } from './OrbitalSelection.js'
import { createCoordinateAxes } from '../../systems/ui/createCoordinateAxes.js'
import { createTextLabel } from '../../systems/ui/createTextLabel.js'

export function createPOrbitalSimulation(app) {
  const settings = createPOrbitalSettings()
  const simulation = createOrbitalSimulation(app, settings)
  const axes = createCoordinateAxes(settings.axesLengthMeters)
  simulation.orbitalRoot.add(axes.group)
  const title = createTextLabel('2px', '#fff7ae', 0.8, 0.25)
  title.sprite.position.set(0, 1.65, 0)
  simulation.contentAnchor.add(title.sprite)
  let selected = '2px'

  const selector = document.createElement('div')
  selector.className = 'orbital-selector'
  selector.setAttribute('role', 'group')
  selector.setAttribute('aria-label', 'Choose a 2p orbital')
  selector.hidden = true
  const buttons = new Map()
  for (const orbital of P_ORBITALS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = orbital.label
    button.setAttribute('aria-pressed', String(orbital.id === selected))
    button.addEventListener('click', () => selectOrbital(orbital.id))
    selector.append(button)
    buttons.set(orbital.id, button)
  }
  document.querySelector('[data-simulation-viewer]')?.append(selector)

  function selectOrbital(id) {
    if (!P_ORBITALS.some(item => item.id === id)) return false
    simulation.resetXRInteraction('orbital-selected')
    selectOrbitalOrientation(simulation.pointCloudRoot, id)
    selected = id
    title.setLabel(id)
    simulation.setOrbitalLabel(id)
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id))
    // Updates the contextual row without rebuilding buttons during a poke.
    if (app.getActiveSimulation?.() === result) app.palmNavigationSystem.refreshContextActions()
    return true
  }

  const result = {
    ...simulation,
    label: '2p',
    selectOrbital,
    getSelectedOrbital: () => selected,
    getOrientationState: () => ({ orientationId: selected, orientationLabel: selected, snapping: false }),
    getMenuActions: () => P_ORBITALS.map(item => ({
      ...item, kind: 'action', active: selected === item.id,
      onSelect: () => selectOrbital(item.id),
    })),
    enter() {
      simulation.enter()
      selector.hidden = app.renderer.xr.isPresenting
    },
    exit() { simulation.exit(); selector.hidden = true },
    update(deltaTime, context) {
      simulation.update(deltaTime, context)
      selector.hidden = Boolean(context.isXR)
    },
    dispose() {
      selector.remove()
      axes.dispose()
      title.dispose()
      simulation.dispose()
    },
  }
  return result
}
