function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue)
}

function nearlyEqual(a, b, epsilon = 0.000001) {
  return Math.abs(a - b) <= epsilon
}

export class RadialScaleControlSystem {
  constructor(options = {}) {
    this.minValue = options.minValue ?? 0
    this.maxValue = options.maxValue ?? 1
    this.dragGain = options.dragGain ?? 1

    this.handPriority = options.handPriority ?? ['right', 'left']
    this.onChange = typeof options.onChange === 'function'
      ? options.onChange
      : null

    this.value = this.clampValue(options.initialValue ?? this.minValue)

    this.active = false
    this.activeHandedness = null
    this.startY = 0
    this.startValue = this.value
  }

  clampValue(value) {
    return clamp(value, this.minValue, this.maxValue)
  }

  get normalizedValue() {
    const range = this.maxValue - this.minValue

    if (range <= 0) {
      return 0
    }

    return (this.value - this.minValue) / range
  }

  setValue(nextValue, eventType = 'set') {
    const clampedValue = this.clampValue(nextValue)

    if (nearlyEqual(clampedValue, this.value)) {
      return this.value
    }

    this.value = clampedValue

    if (this.onChange) {
      this.onChange(this.value, {
        eventType,
        active: this.active,
        activeHandedness: this.activeHandedness,
        normalizedValue: this.normalizedValue,
      })
    }

    return this.value
  }

  setNormalizedValue(nextNormalizedValue, eventType = 'set-normalized') {
    const normalizedValue = clamp(nextNormalizedValue, 0, 1)
    const nextValue = this.minValue + normalizedValue * (this.maxValue - this.minValue)

    return this.setValue(nextValue, eventType)
  }

  setRange({ minValue = this.minValue, maxValue = this.maxValue } = {}) {
    this.minValue = minValue
    this.maxValue = maxValue

    this.setValue(this.value, 'range-change')
  }

  update(interactionState) {
    if (!interactionState) {
      return this.getState()
    }

    if (!this.active) {
      const started = this.getPinchStartedHand(interactionState)

      if (started) {
        this.startInteraction(started.handedness, started.hand)
      }
    }

    if (!this.active) {
      return this.getState()
    }

    const activeHand = interactionState[this.activeHandedness]

    if (
      !activeHand ||
      activeHand.pinchEnded ||
      !activeHand.pinchActive ||
      !activeHand.pinchPosition
    ) {
      this.endInteraction()
      return this.getState()
    }

    const dragY = activeHand.pinchPosition.y - this.startY
    const nextValue = this.startValue + dragY * this.dragGain

    this.setValue(nextValue, 'drag')

    return this.getState()
  }

  getPinchStartedHand(interactionState) {
    for (const handedness of this.handPriority) {
      const hand = interactionState[handedness]

      if (hand?.pinchStarted && hand?.pinchPosition) {
        return {
          handedness,
          hand,
        }
      }
    }

    return null
  }

  startInteraction(handedness, hand) {
    if (!hand?.pinchPosition) {
      return false
    }

    this.active = true
    this.activeHandedness = handedness
    this.startY = hand.pinchPosition.y
    this.startValue = this.value

    return true
  }

  endInteraction() {
    this.active = false
    this.activeHandedness = null
  }

  reset() {
    this.endInteraction()
  }

  getState() {
    return {
      active: this.active,
      activeHandedness: this.activeHandedness,
      value: this.value,
      normalizedValue: this.normalizedValue,
      minValue: this.minValue,
      maxValue: this.maxValue,
    }
  }
}