import { FONT_DISPLAY, FONT_BODY } from '../../../systems/ui/interfaceTheme.js'
import { getCoverageFrames, coverageAt, DZ2_RING_PROBABILITY } from '../data/probabilityCoverage.js'

const LEFT=66, RIGHT=470, TOP=110, BOTTOM=328
export function coverageGraphMaximum(type) { return getCoverageFrames(type).at(-1).volume*1.06 }
export function graphXToVolume(x,type) { return Math.max(0,Math.min(1,(x-LEFT)/(RIGHT-LEFT)))*coverageGraphMaximum(type) }
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value)

export function drawProbabilityGraph(ctx,{state={},width=500,height=400}={}) {
  const type=state.coverageType??'2p',frames=getCoverageFrames(type)
  const maxVolume=coverageGraphMaximum(type)
  const x=v=>LEFT+v/maxVolume*(RIGHT-LEFT),y=p=>BOTTOM-p*(BOTTOM-TOP)
  const coverage=state.probability??0,revealed=state.revealedCount??0,count=state.highlightedCount??0
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#121212';ctx.fillRect(0,0,width,height)
  ctx.textAlign='center';ctx.fillStyle='#fff7ae';ctx.font=`bold 30px ${FONT_DISPLAY}`
  ctx.fillText(coverage ? `${(coverage*100).toFixed(1)}% probability` : 'Enclosure off',width/2,30)
  ctx.fillStyle='rgba(255,255,255,.75)';ctx.font=`600 18px ${FONT_BODY}`
  ctx.fillText(`${count} inside / ${revealed} outcomes plotted`,width/2,53)
  ctx.fillStyle='#ffffff'
  ctx.fillText(coverage ? `enclosed volume: ${number(state.volume??0)} a₀³` : 'Vertical drag: grow the probability enclosure',width/2,75)
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1
  ctx.beginPath();ctx.moveTo(LEFT,89);ctx.lineTo(RIGHT,89);ctx.stroke()
  for(const p of [0.5,0.9]) {
    ctx.strokeStyle='rgba(255,255,255,.16)';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(LEFT,y(p));ctx.lineTo(RIGHT,y(p));ctx.stroke();ctx.setLineDash([])
    ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.7)';ctx.fillText(`${p*100}%`,LEFT-8,y(p)+5)
  }
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.moveTo(LEFT,TOP);ctx.lineTo(LEFT,BOTTOM);ctx.lineTo(RIGHT,BOTTOM);ctx.stroke()
  // The unresolved 0–5% interval is not presented as a measured curve.
  ctx.strokeStyle=type==='2p'?'#ea9fa2':'#80b9ff';ctx.lineWidth=2.5;ctx.beginPath()
  frames.forEach((f,i)=>{if(!i)ctx.moveTo(x(f.volume),y(f.probability));else ctx.lineTo(x(f.volume),y(f.probability))});ctx.stroke()
  if(revealed) {
    ctx.fillStyle='#fff7ae'
    for(let i=0;i<frames.length;i+=4) {
      const f=frames[i], observed=state.observedCounts?.[i]
      if(observed===undefined)continue
      ctx.beginPath();ctx.arc(x(f.volume),y(observed/revealed),2.3,0,Math.PI*2);ctx.fill()
    }
  }
  if(type==='3dz2') {
    const event=coverageAt(type,DZ2_RING_PROBABILITY)
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x(event.volume),BOTTOM);ctx.lineTo(x(event.volume),y(event.probability));ctx.stroke();ctx.setLineDash([])
    ctx.textAlign='left';ctx.fillStyle='rgba(255,255,255,.8)';ctx.font=`16px ${FONT_BODY}`
    ctx.fillText('Ring begins ≈ 29.8%',LEFT+10,BOTTOM-9)
  }
  if(coverage) {
    const selectedX=x(state.volume??0)
    ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(selectedX,BOTTOM);ctx.lineTo(selectedX,y(coverage));ctx.stroke()
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(selectedX,y(coverage),4,0,Math.PI*2);ctx.fill()
    if(revealed) {ctx.fillStyle='#fff7ae';ctx.beginPath();ctx.arc(selectedX,y(count/revealed),4,0,Math.PI*2);ctx.fill()}
  }
  ctx.font=`17px ${FONT_BODY}`;ctx.fillStyle='rgba(255,255,255,.7)'
  ctx.textAlign='left';ctx.fillText('0',LEFT,BOTTOM+18)
  ctx.textAlign='right';ctx.fillText(number(maxVolume),RIGHT,BOTTOM+18)
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('Enclosed volume (a₀³)',width/2,height-28)
  ctx.save();ctx.translate(20,(TOP+BOTTOM)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Probability / fraction',0,0);ctx.restore()
  ctx.font=`16px ${FONT_BODY}`
  ctx.fillStyle=type==='2p'?'#ea9fa2':'#80b9ff';ctx.textAlign='left';ctx.fillText('━ Model',LEFT+8,TOP+15)
  ctx.fillStyle='#fff7ae';ctx.fillText('• Measurements',LEFT+100,TOP+15)
}
