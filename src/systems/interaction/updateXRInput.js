export function hasPinchInteraction(hands = {}) {
  return ['left', 'right'].some(name => {
    const hand = hands[name]
    return hand?.visible && (hand.pinchActive || hand.pinchStarted || hand.pinchCandidateFrames > 0)
  })
}

/** Input priority: locomotion > pinch drag > panel poke. */
export function updateXRInput({ deltaTime, app, playerRig, handLocomotionGestureSystem,
  handLocomotionSystem, handInteractionSystem, palmNavigationSystem, activeSimulation,
  resetActiveXRInteraction }) {
  handLocomotionGestureSystem.update()
  const locomotionHand = handLocomotionSystem.getActiveHand(
    handLocomotionGestureSystem.hands.left, handLocomotionGestureSystem.hands.right)
  // Locomotion owns input even when its thumb is centered. Stop residual
  // movement on exit before allowing a world-space pinch to begin.
  if (!locomotionHand) handLocomotionSystem.reset()
  const locomotionState = handLocomotionSystem.update(deltaTime)
  playerRig.updateMatrixWorld(true)
  handInteractionSystem.update(deltaTime)
  const interactionState = handInteractionSystem.getState()
  const pinchBusy = hasPinchInteraction(interactionState) ||
    Boolean(activeSimulation?.isXRInteractionActive?.())
  if (locomotionHand) resetActiveXRInteraction('locomotion')
  const palmNavigationState = palmNavigationSystem.update(deltaTime, {
    allowPoke: !locomotionHand && !pinchBusy,
    locomoting: Boolean(locomotionState.moveX || locomotionState.moveZ || locomotionState.turnY),
  })
  if (!locomotionHand) {
    activeSimulation?.handleInput?.(interactionState, {
      app, deltaTime, isXR: true, locomotionState,
      interactionState, palmNavigationState,
    })
  }
  return { locomotionState, interactionState, palmNavigationState }
}
