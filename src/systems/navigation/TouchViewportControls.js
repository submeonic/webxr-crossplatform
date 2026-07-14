const STATE_IDLE = 'idle'
const STATE_SINGLE_PENDING = 'single-pending'
const STATE_SINGLE_ORBIT = 'single-orbit'
const STATE_SINGLE_DOLLY = 'single-dolly'
const STATE_PINCH = 'pinch'
const STATE_BLOCKED = 'blocked'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getDistance(pointA, pointB) {
  return Math.hypot(
    pointB.x - pointA.x,
    pointB.y - pointA.y,
  )
}

/**
 * Recognizes pointer gestures over the shared web viewport and routes them to
 * either the orbit camera or an optional parameter binding supplied by the
 * active simulation.
 *
 * Gesture mapping:
 * - One-pointer horizontal drag: orbit camera
 * - One-pointer vertical drag: dolly camera
 * - Two-touch pinch/spread: active simulation parameter
 *
 * Supported one-pointer devices:
 * - Touch
 * - Mouse left-button drag
 * - Pen/stylus
 */
export class TouchViewportControls {
  constructor(options = {}) {
    this.element = options.element
    this.orbitCameraController =
      options.orbitCameraController

    if (!this.element) {
      throw new Error(
        'TouchViewportControls requires options.element',
      )
    }

    if (!this.orbitCameraController) {
      throw new Error(
        'TouchViewportControls requires options.orbitCameraController',
      )
    }

    this.getPinchBinding =
      options.getPinchBinding ?? (() => null)

    this.isEnabled = options.isEnabled ?? (() => true)

    this.settings = {
      dragActivationPixels:
        options.dragActivationPixels ?? 8,
      orbitRadiansPerPixel:
        options.orbitRadiansPerPixel ?? 0.006,
      dollyDistancePerPixel:
        options.dollyDistancePerPixel ?? 0.01,

      // Negative gives the expected grab-and-drag behavior:
      // dragging right moves the viewed object toward the right.
      orbitDragSign:
        options.orbitDragSign ?? -1,

      // Positive means dragging downward moves farther away.
      dollyDragSign:
        options.dollyDragSign ?? 1,

      defaultFullRangePinchDistancePx:
        options.defaultFullRangePinchDistancePx ?? 220,
    }

    this.pointers = new Map()
    this.state = STATE_IDLE
    this.cameraInteractionActive = false

    this.singleStart = { x: 0, y: 0 }
    this.singleLast = { x: 0, y: 0 }

    this.pinchBinding = null
    this.pinchStartDistance = 0
    this.pinchStartValue = 0
    this.pinchMinValue = 0
    this.pinchMaxValue = 1
    this.pinchFullRangeDistancePx =
      this.settings.defaultFullRangePinchDistancePx

    this.previousTouchAction = this.element.style.touchAction
    this.previousCursor = this.element.style.cursor

    this.element.style.touchAction = 'none'
    this.element.style.cursor = 'grab'

    this.handlePointerDown =
      this.handlePointerDown.bind(this)
    this.handlePointerMove =
      this.handlePointerMove.bind(this)
    this.handlePointerEnd =
      this.handlePointerEnd.bind(this)
    this.handleLostPointerCapture =
      this.handleLostPointerCapture.bind(this)
    this.handleWindowBlur =
      this.handleWindowBlur.bind(this)
    this.handleVisibilityChange =
      this.handleVisibilityChange.bind(this)

    this.element.addEventListener(
      'pointerdown',
      this.handlePointerDown,
      { passive: false },
    )

    this.element.addEventListener(
      'pointermove',
      this.handlePointerMove,
      { passive: false },
    )

    this.element.addEventListener(
      'pointerup',
      this.handlePointerEnd,
      { passive: false },
    )

    this.element.addEventListener(
      'pointercancel',
      this.handlePointerEnd,
      { passive: false },
    )

    this.element.addEventListener(
      'lostpointercapture',
      this.handleLostPointerCapture,
    )

    window.addEventListener('blur', this.handleWindowBlur)
    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    )
  }

  isSupportedPointer(event) {
    return (
      event.pointerType === 'touch' ||
      event.pointerType === 'mouse' ||
      event.pointerType === 'pen'
    )
  }

  isValidPointerDown(event) {
    if (!this.isSupportedPointer(event)) return false

    // Mouse interactions use only the primary/left button.
    if (event.pointerType === 'mouse') {
      return event.button === 0
    }

    return true
  }

  canInteract() {
    try {
      return Boolean(this.isEnabled())
    } catch (error) {
      console.warn(
        '[TouchViewportControls] isEnabled callback failed:',
        error,
      )
      return false
    }
  }

  capturePointer(pointerId) {
    try {
      this.element.setPointerCapture(pointerId)
    } catch {
      // Pointer capture can fail if the pointer ended immediately.
    }
  }

  releasePointer(pointerId) {
    try {
      if (this.element.hasPointerCapture(pointerId)) {
        this.element.releasePointerCapture(pointerId)
      }
    } catch {
      // It is safe to ignore capture cleanup failures.
    }
  }

  updateCursor() {
    const hasMousePointer = Array.from(
      this.pointers.values(),
    ).some((pointer) => pointer.pointerType === 'mouse')

    this.element.style.cursor = hasMousePointer
      ? 'grabbing'
      : 'grab'
  }

  beginCameraInteraction() {
    if (this.cameraInteractionActive) return

    this.cameraInteractionActive = true
    this.orbitCameraController.beginInteraction()
  }

  endCameraInteraction() {
    if (!this.cameraInteractionActive) return

    this.cameraInteractionActive = false
    this.orbitCameraController.endInteraction()
  }

  handlePointerDown(event) {
    if (!this.isValidPointerDown(event)) return
    if (!this.canInteract()) return

    event.preventDefault()

    this.capturePointer(event.pointerId)

    if (this.pointers.size === 0) {
      this.beginCameraInteraction()
    }

    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    })

    this.updateCursor()

    if (this.pointers.size === 1) {
      this.beginSingleGesture(event.clientX, event.clientY)
      return
    }

    if (this.pointers.size === 2) {
      if (this.canUsePinchGesture()) {
        this.beginPinchGesture()
      } else {
        this.state = STATE_BLOCKED
        this.clearPinchState()
      }
      return
    }

    this.state = STATE_BLOCKED
    this.clearPinchState()
  }

  handlePointerMove(event) {
    if (!this.isSupportedPointer(event)) return
    if (!this.pointers.has(event.pointerId)) return

    /*
    Some browsers can report a mouse move after the left button has already
    been released. Clear the gesture instead of leaving the camera stuck.
    */
    if (
      event.pointerType === 'mouse' &&
      (event.buttons & 1) === 0
    ) {
      this.endPointer(event.pointerId)
      return
    }

    event.preventDefault()

    if (!this.canInteract()) {
      this.reset()
      return
    }

    const point = this.pointers.get(event.pointerId)
    point.x = event.clientX
    point.y = event.clientY

    if (this.state === STATE_PINCH) {
      this.updatePinchGesture()
      return
    }

    if (this.pointers.size !== 1) return

    this.updateSingleGesture(point.x, point.y)
  }

  handlePointerEnd(event) {
    if (!this.isSupportedPointer(event)) return
    if (!this.pointers.has(event.pointerId)) return

    event.preventDefault()
    this.endPointer(event.pointerId)
  }

  endPointer(pointerId) {
    this.pointers.delete(pointerId)
    this.releasePointer(pointerId)
    this.updateCursor()

    if (this.pointers.size === 0) {
      this.endCameraInteraction()
    }

    /*
    After a two-finger gesture, the remaining finger must be released before
    another orbit/dolly gesture can begin. This prevents sudden camera jumps.
    */
    if (
      this.state === STATE_PINCH ||
      this.state === STATE_BLOCKED
    ) {
      this.clearPinchState()
      this.state =
        this.pointers.size === 0
          ? STATE_IDLE
          : STATE_BLOCKED
      return
    }

    this.state =
      this.pointers.size === 0
        ? STATE_IDLE
        : STATE_BLOCKED
  }

  handleLostPointerCapture(event) {
    if (!this.pointers.has(event.pointerId)) return

    this.pointers.delete(event.pointerId)
    this.updateCursor()

    if (this.pointers.size === 0) {
      this.endCameraInteraction()
      this.state = STATE_IDLE
      this.clearPinchState()
    } else {
      this.state = STATE_BLOCKED
    }
  }

  handleWindowBlur() {
    this.reset()
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.reset()
    }
  }

  beginSingleGesture(x, y) {
    this.clearPinchState()

    this.singleStart.x = x
    this.singleStart.y = y
    this.singleLast.x = x
    this.singleLast.y = y

    this.state = STATE_SINGLE_PENDING
  }

  updateSingleGesture(x, y) {
    if (this.state === STATE_SINGLE_PENDING) {
      const totalX = x - this.singleStart.x
      const totalY = y - this.singleStart.y

      if (
        Math.hypot(totalX, totalY) <
        this.settings.dragActivationPixels
      ) {
        return
      }

      if (Math.abs(totalX) >= Math.abs(totalY)) {
        this.state = STATE_SINGLE_ORBIT

        this.orbitCameraController.applyOrbitDelta(
          totalX *
            this.settings.orbitRadiansPerPixel *
            this.settings.orbitDragSign,
        )
      } else {
        this.state = STATE_SINGLE_DOLLY

        this.orbitCameraController.applyDollyDelta(
          totalY *
            this.settings.dollyDistancePerPixel *
            this.settings.dollyDragSign,
        )
      }

      this.singleLast.x = x
      this.singleLast.y = y
      return
    }

    const deltaX = x - this.singleLast.x
    const deltaY = y - this.singleLast.y

    this.singleLast.x = x
    this.singleLast.y = y

    if (this.state === STATE_SINGLE_ORBIT) {
      this.orbitCameraController.applyOrbitDelta(
        deltaX *
          this.settings.orbitRadiansPerPixel *
          this.settings.orbitDragSign,
      )
    } else if (this.state === STATE_SINGLE_DOLLY) {
      this.orbitCameraController.applyDollyDelta(
        deltaY *
          this.settings.dollyDistancePerPixel *
          this.settings.dollyDragSign,
      )
    }
  }

  canUsePinchGesture() {
    if (this.pointers.size !== 2) return false

    // Pinch/stretch is intended for two simultaneous direct-touch pointers.
    return Array.from(this.pointers.values()).every(
      (pointer) =>
        pointer.pointerType === 'touch' ||
        pointer.pointerType === 'pen',
    )
  }

  beginPinchGesture() {
    const points = Array.from(this.pointers.values())

    if (points.length < 2) return

    this.state = STATE_PINCH
    this.pinchStartDistance = getDistance(
      points[0],
      points[1],
    )

    this.pinchBinding = this.resolvePinchBinding()

    if (!this.pinchBinding) return

    this.pinchMinValue = this.pinchBinding.minValue
    this.pinchMaxValue = this.pinchBinding.maxValue

    this.pinchStartValue = clamp(
      this.pinchBinding.getValue(),
      this.pinchMinValue,
      this.pinchMaxValue,
    )

    this.pinchFullRangeDistancePx = Math.max(
      1,
      this.pinchBinding.fullRangePinchDistancePx ??
        this.settings.defaultFullRangePinchDistancePx,
    )
  }

  updatePinchGesture() {
    if (!this.pinchBinding) return

    this.orbitCameraController.notifyInteraction()

    const points = Array.from(this.pointers.values())

    if (points.length < 2) return

    const currentDistance = getDistance(
      points[0],
      points[1],
    )

    const distanceDelta =
      currentDistance - this.pinchStartDistance

    const normalizedDelta =
      distanceDelta / this.pinchFullRangeDistancePx

    const valueRange =
      this.pinchMaxValue - this.pinchMinValue

    const nextValue = clamp(
      this.pinchStartValue + normalizedDelta * valueRange,
      this.pinchMinValue,
      this.pinchMaxValue,
    )

    this.pinchBinding.setValue(nextValue)
  }

  resolvePinchBinding() {
    let binding = null

    try {
      binding = this.getPinchBinding()
    } catch (error) {
      console.warn(
        '[TouchViewportControls] getPinchBinding callback failed:',
        error,
      )
      return null
    }

    if (!binding) return null

    const isValid =
      typeof binding.getValue === 'function' &&
      typeof binding.setValue === 'function' &&
      Number.isFinite(binding.minValue) &&
      Number.isFinite(binding.maxValue) &&
      binding.maxValue > binding.minValue

    if (!isValid) {
      console.warn(
        '[TouchViewportControls] Ignoring invalid pinch binding.',
      )
      return null
    }

    return binding
  }

  clearPinchState() {
    this.pinchBinding = null
    this.pinchStartDistance = 0
    this.pinchStartValue = 0
  }

  reset() {
    for (const pointerId of this.pointers.keys()) {
      this.releasePointer(pointerId)
    }

    this.pointers.clear()
    this.endCameraInteraction()
    this.state = STATE_IDLE
    this.clearPinchState()
    this.updateCursor()
  }

  dispose() {
    this.reset()

    this.element.removeEventListener(
      'pointerdown',
      this.handlePointerDown,
    )

    this.element.removeEventListener(
      'pointermove',
      this.handlePointerMove,
    )

    this.element.removeEventListener(
      'pointerup',
      this.handlePointerEnd,
    )

    this.element.removeEventListener(
      'pointercancel',
      this.handlePointerEnd,
    )

    this.element.removeEventListener(
      'lostpointercapture',
      this.handleLostPointerCapture,
    )

    window.removeEventListener('blur', this.handleWindowBlur)
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    )

    this.element.style.touchAction = this.previousTouchAction
    this.element.style.cursor = this.previousCursor
  }
}
