import { createOrbitalSimulation } from '../shared/createOrbitalSimulation.js'
import { createCoordinateAxes } from '../../systems/ui/createCoordinateAxes.js'
import { createTextLabel } from '../../systems/ui/createTextLabel.js'
import { generate3dSamples } from './data/dOrbitalSamplers.js'
import { D_ORBITALS, selectDOrbitalOrientation } from './OrbitalSelection.js'

export function createDOrbitalSimulation(app) {
  const settings={
    id:'3d-orbital',label:'3dxy',family:'d',measurementMode:'coverage',coverageType:'3d',
    xrMenuLabel:'3d',xrMenuOrder:4,showInXRMenu:true,
    sampleGenerator:generate3dSamples,seed:3303,electronCount:1000,sampleMaxRadiusA0:Infinity,
    shellMinRadiusA0:0.25,shellMaxRadiusA0:30,initialShellOuterRadiusA0:5.35,
    simulationScale:0.32,webInitialCameraDistance:2.8,webCameraHeightOffset:1.4,a0ToMeters:0.25,
    initialYawRadians:0.25,
    electronRadiusMeters:0.05,nucleusRadiusMeters:0.09,
    pointColor:0xeadfad,pointOpacity:0.16,highlightColor:0xfff7ae,highlightOpacity:0.98,shellColor:0xfff7ae,
    regionColor:0x80b9ff,regionRimColor:0xfff7ae,
    desktopGraphContainerId:'3d-orbital-desktop-graph',
    desktopGraphAriaLabel:'3d enclosed volume versus probability and measured fraction; drag horizontally or use arrow keys',
    graphConfig:{kind:'coverage'},
  }
  const simulation=createOrbitalSimulation(app,settings)
  const axes=createCoordinateAxes(4.8)
  simulation.orbitalRoot.add(axes.group)
  const title=createTextLabel('3dxy','#fff7ae',0.8,0.25)
  title.sprite.position.set(0,1.8,0);simulation.contentAnchor.add(title.sprite)
  let selected='3dxy'
  selectDOrbitalOrientation(simulation.distributionRoot,selected)
  simulation.webControlsElement.className+=' orbital-controls--with-orientation orbital-controls--d'
  const choices=document.createElement('div')
  choices.className='orbital-control-group orbital-control-group--orientation'
  choices.setAttribute('role','radiogroup');choices.setAttribute('aria-label','Choose a 3d orbital')
  simulation.webControlsElement.insertBefore(choices,simulation.webViewActionsGroup)
  const buttons=new Map()
  for(const orbital of D_ORBITALS) {
    const button=document.createElement('button')
    button.type='button';button.textContent=orbital.label;button.setAttribute('role','radio')
    button.setAttribute('aria-checked',String(orbital.id===selected))
    button.addEventListener('click',()=>selectOrbital(orbital.id));choices.append(button);buttons.set(orbital.id,button)
  }
  function selectOrbital(id) {
    const orbital=D_ORBITALS.find(o=>o.id===id)
    if(!orbital)return false
    if(selected===id)return true
    simulation.resetXRInteraction('orbital-selected')
    simulation.setCoverageType(orbital.type)
    selectDOrbitalOrientation(simulation.distributionRoot,id)
    selected=id;title.setLabel(orbital.label);simulation.setOrbitalLabel(orbital.label)
    for(const [key,button] of buttons)button.setAttribute('aria-checked',String(key===id))
    simulation.restartMeasurementReveal()
    if(app.getActiveSimulation?.()===result)app.palmNavigationSystem.refreshContextActions()
    return true
  }
  const result={...simulation,label:'3d',orbitalChoices:D_ORBITALS,selectOrbital,
    get probabilityRegionRoot(){return simulation.probabilityRegionRoot},
    getSelectedOrbital:()=>selected,
    getMenuActions:()=>[
      ...D_ORBITALS.map(o=>({...o,kind:'action',group:'orientation',active:selected===o.id,onSelect:()=>selectOrbital(o.id)})),
      ...simulation.getMenuActions(),
    ],
    dispose(){axes.dispose();title.dispose();simulation.dispose()},
  }
  return result
}
