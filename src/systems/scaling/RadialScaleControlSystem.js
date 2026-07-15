import * as THREE from 'three'

import { PinchDragControlSystem } from '../interaction/PinchDragControlSystem.js'

/**
 * Backward-compatible vertical shell-radius control.
 * New simulations should prefer PinchDragControlSystem directly.
 */
export class RadialScaleControlSystem extends PinchDragControlSystem {
  constructor(options = {}) {
    const range = (options.maxValue ?? 1) - (options.minValue ?? 0)
    const legacyDragGain = options.dragGain

    super({
      axisMode: 'world',
      axisVector: new THREE.Vector3(0, 1, 0),
      positiveLabel: '+',
      negativeLabel: '−',
      fullRangeDragDistance:
        options.fullRangeDragDistance ??
        (Number.isFinite(legacyDragGain) && legacyDragGain > 0
          ? range / legacyDragGain
          : 0.3),
      ...options,
    })
  }
}
