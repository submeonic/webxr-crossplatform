export function areAllFingersOpen(hand, threshold) {
  return Boolean(hand?.visible) && ['thumbCurl', 'indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl']
    .every(key => Number.isFinite(hand[key]) && hand[key] <= threshold)
}

export function hasPinchInteraction(hands = {}) {
  return ['left', 'right'].some(name => {
    const hand = hands[name]
    return hand?.visible && (hand.pinchActive || hand.pinchStarted || hand.pinchCandidateFrames > 0)
  })
}
