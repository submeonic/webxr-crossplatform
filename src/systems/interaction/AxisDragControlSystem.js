import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

/** One pinch owns one action until release. Axes are captured at pinch start. */
export class AxisDragControlSystem {
  constructor({ camera, indicator, horizontal, vertical, thresholdMeters = 0.012,
    dominanceRatio = 1.2, handPriority = ['right', 'left'] }) {
    Object.assign(this, { camera, indicator, horizontal, vertical, thresholdMeters,
      dominanceRatio, handPriority })
    this.origin = new THREE.Vector3()
    this.right = new THREE.Vector3(1, 0, 0)
    this.delta = new THREE.Vector3()
    this.rotation = new THREE.Quaternion()
    this.hand = null
    this.axis = null
  }

  update(state) {
    if (!state) { this.reset('tracking-lost'); return }
    if (!this.hand) {
      const name = this.handPriority.find(name => state[name]?.visible &&
        state[name].pinchStarted && state[name].pinchPosition)
      if (!name) return
      this.hand = name
      this.origin.copy(state[name].pinchPosition)
      this.camera.getWorldQuaternion(this.rotation)
      this.right.set(1, 0, 0).applyQuaternion(this.rotation)
      this.right.y = 0
      if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0)
      this.right.normalize()
    }
    const hand = state[this.hand]
    if (!hand?.visible || !hand.pinchActive || hand.pinchEnded || !hand.pinchPosition) {
      this.reset('pinch-ended')
      return
    }
    this.delta.copy(hand.pinchPosition).sub(this.origin)
    const x = this.delta.dot(this.right)
    const y = this.delta.y
    if (!this.axis) {
      const ax = Math.abs(x), ay = Math.abs(y)
      if (Math.max(ax, ay) < this.thresholdMeters) return
      if (ax > ay * this.dominanceRatio && this.horizontal) this.axis = 'horizontal'
      if (ay > ax * this.dominanceRatio && this.vertical) this.axis = 'vertical'
      if (!this.axis) return
      this[this.axis].onStart?.()
      this.indicator?.show({ originWorldPosition: this.origin,
        axisVector: this.axis === 'horizontal' ? this.right : UP,
        positiveLabel: this.axis === 'horizontal' ? '↻' : '+',
        negativeLabel: this.axis === 'horizontal' ? '↺' : '−' })
    }
    const displacement = this.axis === 'horizontal' ? x : y
    const limits = this[this.axis].onChange?.(displacement) ?? {}
    this.indicator?.update({ axisDisplacementMeters: displacement, ...limits })
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
