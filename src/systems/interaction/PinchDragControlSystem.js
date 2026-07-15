import * as THREE from 'three'

const EPSILON = 0.000001

export class PinchDragControlSystem {
  constructor(options = {}) {
    this.minValue = options.minValue ?? 0
    this.maxValue = options.maxValue ?? 1
    this.fullRangeDragDistance = Math.max(
      EPSILON,
      options.fullRangeDragDistance ?? 0.3,
    )

    this.handPriority = options.handPriority ?? ['right', 'left']
    this.axisMode = options.axisMode ?? 'world'
    this.axisVector = (
      options.axisVector ?? axisNameToVector(options.axis ?? 'y')
    ).clone().normalize()
    this.positiveDirection = options.positiveDirection ?? 1

    this.positiveLabel = options.positiveLabel ?? '+'
    this.negativeLabel = options.negativeLabel ?? '−'

    this.indicator = options.indicator ?? null
    this.onStart = typeof options.onStart === 'function'
      ? options.onStart
      : null
    this.onChange = typeof options.onChange === 'function'
      ? options.onChange
      : null
    this.onEnd = typeof options.onEnd === 'function'
      ? options.onEnd
      : null

    this.active = false
    this.activeHand = null
    this.startValue = this.clampValue(
      options.initialValue ?? this.minValue,
    )
    this.currentValue = this.startValue
    this.normalizedValue = this.getNormalizedValue(this.currentValue)

    this.originWorldPosition = new THREE.Vector3()
    this.currentWorldPosition = new THREE.Vector3()
    this.axisDisplacementMeters = 0
    this._difference = new THREE.Vector3()
  }

  clampValue(value) {
    return THREE.MathUtils.clamp(
      value,
      this.minValue,
      this.maxValue,
    )
  }

  getNormalizedValue(value) {
    const range = this.maxValue - this.minValue
    if (range <= EPSILON) return 0
    return (value - this.minValue) / range
  }

  setValue(nextValue, eventType = 'set') {
    const clampedValue = this.clampValue(nextValue)
    const changed = Math.abs(clampedValue - this.currentValue) > EPSILON

    this.currentValue = clampedValue
    this.normalizedValue = this.getNormalizedValue(clampedValue)

    if (changed && this.onChange) {
      this.onChange(this.currentValue, {
        ...this.getState(),
        eventType,
      })
    }

    return this.currentValue
  }

  setRange({
    minValue = this.minValue,
    maxValue = this.maxValue,
  } = {}) {
    this.minValue = minValue
    this.maxValue = maxValue
    return this.setValue(this.currentValue, 'range-change')
  }

  update(interactionState) {
    if (!interactionState) return this.getState()

    if (!this.active) {
      const started = this.getPinchStartedHand(interactionState)
      if (started) {
        this.startInteraction(started.handedness, started.hand)
      }
    }

    if (!this.active) return this.getState()

    const hand = interactionState[this.activeHand]

    if (
      !hand ||
      hand.pinchEnded ||
      !hand.pinchActive ||
      !hand.visible ||
      !hand.pinchPosition
    ) {
      this.endInteraction('pinch-ended')
      return this.getState()
    }

    this.currentWorldPosition.copy(hand.pinchPosition)
    this._difference
      .copy(this.currentWorldPosition)
      .sub(this.originWorldPosition)

    this.axisDisplacementMeters =
      this._difference.dot(this.axisVector) *
      this.positiveDirection

    const normalizedDelta =
      this.axisDisplacementMeters /
      this.fullRangeDragDistance

    const valueRange = this.maxValue - this.minValue
    const nextValue =
      this.startValue + normalizedDelta * valueRange

    this.setValue(nextValue, 'pinch-drag')

    this.indicator?.update({
      axisDisplacementMeters: this.axisDisplacementMeters,
      atMinimum: this.currentValue <= this.minValue + EPSILON,
      atMaximum: this.currentValue >= this.maxValue - EPSILON,
    })

    return this.getState()
  }

  getPinchStartedHand(interactionState) {
    for (const handedness of this.handPriority) {
      const hand = interactionState[handedness]

      if (
        hand?.visible &&
        hand.pinchStarted &&
        hand.pinchPosition
      ) {
        return { handedness, hand }
      }
    }

    return null
  }

  startInteraction(handedness, hand) {
    if (!hand?.pinchPosition) return false

    this.active = true
    this.activeHand = handedness
    this.startValue = this.currentValue
    this.axisDisplacementMeters = 0
    this.originWorldPosition.copy(hand.pinchPosition)
    this.currentWorldPosition.copy(hand.pinchPosition)

    this.indicator?.show({
      originWorldPosition: this.originWorldPosition,
      axisVector: this.axisVector,
      positiveLabel: this.positiveLabel,
      negativeLabel: this.negativeLabel,
    })

    this.onStart?.(this.getState())
    return true
  }

  endInteraction(reason = 'end') {
    if (!this.active) {
      this.indicator?.hide()
      return
    }

    const finalState = {
      ...this.getState(),
      reason,
    }

    this.active = false
    this.activeHand = null
    this.axisDisplacementMeters = 0
    this.indicator?.hide()
    this.onEnd?.(finalState)
  }

  reset(reason = 'reset') {
    this.endInteraction(reason)
  }

  isActive() {
    return this.active
  }

  getState() {
    return {
      active: this.active,
      activeHand: this.activeHand,
      activeHandedness: this.activeHand,
      startValue: this.startValue,
      currentValue: this.currentValue,
      value: this.currentValue,
      normalizedValue: this.normalizedValue,
      minValue: this.minValue,
      maxValue: this.maxValue,
      fullRangeDragDistance: this.fullRangeDragDistance,
      originWorldPosition: this.originWorldPosition,
      currentWorldPosition: this.currentWorldPosition,
      axisDisplacementMeters: this.axisDisplacementMeters,
    }
  }
}

function axisNameToVector(axis) {
  if (axis === 'x') return new THREE.Vector3(1, 0, 0)
  if (axis === 'z') return new THREE.Vector3(0, 0, 1)
  return new THREE.Vector3(0, 1, 0)
}
