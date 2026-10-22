export const REVEAL_SECONDS=3

// Time based, independent of frame rate; late frames reveal a batch of instances.
export function revealedMeasurementCount(elapsed,count,reducedMotion=false) {
  if(reducedMotion||elapsed>=REVEAL_SECONDS)return count
  const t=Math.max(0,elapsed)/REVEAL_SECONDS
  return Math.min(count,Math.floor(count*Math.expm1(5*t)/Math.expm1(5)))
}
