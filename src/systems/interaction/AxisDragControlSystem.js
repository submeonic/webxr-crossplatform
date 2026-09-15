import * as THREE from 'three'

/** One pinch owns one action until release. Axes are captured at pinch start. */
export class AxisDragControlSystem {
  constructor({ camera, indicator, horizontal, vertical, thresholdMeters = 0.006,
    dominanceRatio = 1.1, switchMarginMeters = 0.012, handPriority = ['right', 'left'] }) {
    Object.assign(this, { camera, indicator, horizontal, vertical, thresholdMeters,
      dominanceRatio, switchMarginMeters, handPriority })
    this.origin = new THREE.Vector3()
    this.right = new THREE.Vector3(1, 0, 0)
    this.delta = new THREE.Vector3()
    this.smoothed = new THREE.Vector3()
    this.rotation = new THREE.Quaternion()
    this.hand = null
    this.axis = null
    this.axisOrigins = { horizontal: 0, vertical: 0 }
  }

  update(state, deltaTime = 1 / 60) {
    if (!state) { this.reset('tracking-lost'); return }
    if (!this.hand) {
      const name = this.handPriority.find(name => state[name]?.visible &&
        state[name].pinchStarted && state[name].pinchPosition)
      if (!name) return
      this.hand = name
      this.origin.copy(state[name].pinchPosition)
      this.smoothed.copy(this.origin)
      this.camera.getWorldQuaternion(this.rotation)
      this.right.set(1, 0, 0).applyQuaternion(this.rotation)
      this.right.y = 0
      if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0)
      this.right.normalize()
      this.indicator?.show({ originWorldPosition: this.origin, rightVector: this.right, pending: true })
    }
    const hand = state[this.hand]
    if (!hand?.visible || !hand.pinchActive || hand.pinchEnded || !hand.pinchPosition) {
      this.reset('pinch-ended')
      return
    }
    const alpha = 1 - Math.exp(-Math.min(Math.max(deltaTime, 0), .1) / .045)
    this.smoothed.lerp(hand.pinchPosition, alpha)
    this.indicator?.update({ currentWorldPosition: this.smoothed })
    this.delta.copy(this.smoothed).sub(this.origin)
    const x = this.delta.dot(this.right)
    const y = this.delta.y
    const ax = Math.abs(x), ay = Math.abs(y)
    let nextAxis = this.axis
    if (!this.axis) {
      if (Math.max(ax, ay) < this.thresholdMeters) return
      if (ax > ay * this.dominanceRatio && this.horizontal) nextAxis = 'horizontal'
      if (ay > ax * this.dominanceRatio && this.vertical) nextAxis = 'vertical'
    } else if (this.axis === 'horizontal' && this.vertical && ay > ax + this.switchMarginMeters) {
      nextAxis = 'vertical'
    } else if (this.axis === 'vertical' && this.horizontal && ax > ay + this.switchMarginMeters) {
      nextAxis = 'horizontal'
    }
    if (!nextAxis) return
    if (nextAxis !== this.axis) {
      const switching = this.axis !== null
      if (switching) this[this.axis].onEnd?.({ reason: 'axis-switched' })
      this.axis = nextAxis
      // Compare against the original pinch, but resume each control without a value jump.
      this.axisOrigins[this.axis] = switching ? (this.axis === 'horizontal' ? x : y) : 0
      this[this.axis].onStart?.()
      this.indicator?.setAxis(this.axis)
    }
    const displacement = (this.axis === 'horizontal' ? x : y) - this.axisOrigins[this.axis]
    const limits = this[this.axis].onChange?.(displacement) ?? {}
    this.indicator?.update({ currentWorldPosition: this.smoothed, ...limits })
  }

  isActive() { return this.hand !== null }
  getState() { return { active: this.isActive(), activeHand: this.hand, axis: this.axis } }
  reset(reason = 'reset') {
    if (this.axis) this[this.axis].onEnd?.({ reason })
    this.hand = null
    this.axis = null
    this.indicator?.hide()
  }
}
