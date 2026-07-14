const STATE_IDLE = 'idle'
const STATE_SINGLE_PENDING = 'single-pending'
const STATE_SINGLE_HORIZONTAL = 'single-horizontal'
const STATE_SINGLE_VERTICAL = 'single-vertical'
const STATE_PINCH = 'pinch'
const STATE_BLOCKED = 'blocked'

function getDistance(pointA, pointB) {
  return Math.hypot(
    pointB.x - pointA.x,
    pointB.y - pointA.y,
  )
}

function getCenter(pointA, pointB) {
  return {
    x: (pointA.x + pointB.x) * 0.5,
    y: (pointA.y + pointB.y) * 0.5,
  }
}

/**
 * Recognizes mouse, touch, pen, pinch, and wheel gestures over the shared web
 * viewport. The active simulation may override a gesture through
 * getWebInteractionProfile(); gestures without an override use the shared
 * camera behavior where one exists.
 *
 * Default mapping:
 * - Horizontal pointer drag: orbit camera
 * - Vertical pointer drag: active simulation interaction, otherwise no-op
 * - Two-finger pinch/stretch: dolly camera
 * - Mouse wheel: dolly camera
 *
 * A simulation profile may provide:
 * {
 *   idleCameraOrbit: false,
 *   horizontalDrag: { onStart, onChange, onEnd },
 *   verticalDrag: { onStart, onChange, onEnd },
 *   pinch: { onStart, onChange, onEnd },
 *   wheel: { onChange },
 * }
 */
export class WebInteractionController {
  constructor(options = {}) {
    this.element = options.element
    this.orbitCameraController =
      options.orbitCameraController

    if (!this.element) {
      throw new Error(
        'WebInteractionController requires options.element',
      )
    }

    if (!this.orbitCameraController) {
      throw new Error(
        'WebInteractionController requires options.orbitCameraController',
      )
    }

    this.getInteractionProfile =
      options.getInteractionProfile ?? (() => null)

    this.isEnabled = options.isEnabled ?? (() => true)

    this.settings = {
      dragActivationPixels:
        options.dragActivationPixels ?? 8,

      orbitRadiansPerPixel:
        options.orbitRadiansPerPixel ?? 0.006,

      // Negative gives grab-and-drag orbit behavior.
      orbitDragSign: options.orbitDragSign ?? -1,

      // Pinching outward moves the camera closer by default.
      pinchDollyDistancePerPixel:
        options.pinchDollyDistancePerPixel ?? 0.01,
      pinchDollySign: options.pinchDollySign ?? -1,

      // Positive wheel delta moves the camera farther away.
      wheelDollyDistancePerPixel:
        options.wheelDollyDistancePerPixel ?? 0.0025,
      wheelDollySign: options.wheelDollySign ?? 1,
    }

    this.pointers = new Map()
    this.state = STATE_IDLE
    this.interactionLockActive = false

    this.singleStart = { x: 0, y: 0 }
    this.singleLast = { x: 0, y: 0 }
    this.singlePointerType = null
    this.activeDrag = null

    this.pinchStartDistance = 0
    this.pinchLastDistance = 0
    this.pinchHandler = null

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
    this.handleWheel = this.handleWheel.bind(this)
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

    this.element.addEventListener(
      'wheel',
      this.handleWheel,
      { passive: false },
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
        '[WebInteractionController] isEnabled callback failed:',
        error,
      )
      return false
    }
  }

  resolveInteractionProfile() {
    try {
      return this.getInteractionProfile?.() ?? null
    } catch (error) {
      console.warn(
        '[WebInteractionController] getInteractionProfile callback failed:',
        error,
      )
      return null
    }
  }

  callHandler(handler, methodName, payload) {
    const callback = handler?.[methodName]
    if (typeof callback !== 'function') return

    try {
      callback(payload)
    } catch (error) {
      console.error(
        `[WebInteractionController] ${methodName} callback failed:`,
        error,
      )
    }
  }

  capturePointer(pointerId) {
    try {
      this.element.setPointerCapture(pointerId)
    } catch {
      // Capture may fail if the pointer ends immediately.
    }
  }

  releasePointer(pointerId) {
    try {
      if (this.element.hasPointerCapture(pointerId)) {
        this.element.releasePointerCapture(pointerId)
      }
    } catch {
      // Capture cleanup failures are safe to ignore.
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

  beginInteractionLock() {
    if (this.interactionLockActive) return

    this.interactionLockActive = true
    this.orbitCameraController.beginInteraction()
  }

  endInteractionLock() {
    if (!this.interactionLockActive) return

    this.interactionLockActive = false
    this.orbitCameraController.endInteraction()
  }

  handlePointerDown(event) {
    if (!this.isValidPointerDown(event)) return
    if (!this.canInteract()) return

    event.preventDefault()
    this.capturePointer(event.pointerId)

    if (this.pointers.size === 0) {
      this.beginInteractionLock()
    }

    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    })

    this.updateCursor()

    if (this.pointers.size === 1) {
      this.beginSingleGesture(
        event.clientX,
        event.clientY,
        event.pointerType,
      )
      return
    }

    if (this.pointers.size === 2) {
      this.endActiveDrag(true)

      if (this.canUsePinchGesture()) {
        this.beginPinchGesture()
      } else {
        this.state = STATE_BLOCKED
        this.endPinchGesture(true)
      }
      return
    }

    this.endActiveDrag(true)
    this.endPinchGesture(true)
    this.state = STATE_BLOCKED
  }

  handlePointerMove(event) {
    if (!this.isSupportedPointer(event)) return
    if (!this.pointers.has(event.pointerId)) return

    if (
      event.pointerType === 'mouse' &&
      (event.buttons & 1) === 0
    ) {
      this.endPointer(event.pointerId, true)
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
    this.endPointer(event.pointerId, false)
  }

  endPointer(pointerId, cancelled) {
    const wasPinching = this.state === STATE_PINCH
    const wasBlocked = this.state === STATE_BLOCKED

    this.pointers.delete(pointerId)
    this.releasePointer(pointerId)
    this.updateCursor()

    if (wasPinching) {
      this.endPinchGesture(cancelled)
    } else if (!wasBlocked) {
      this.endActiveDrag(cancelled)
    }

    if (this.pointers.size === 0) {
      this.endInteractionLock()
      this.state = STATE_IDLE
      return
    }

    // After a multi-pointer gesture, require all fingers to be released before
    // another one-pointer gesture can start. This prevents sudden jumps.
    this.state = STATE_BLOCKED
  }

  handleLostPointerCapture(event) {
    if (!this.pointers.has(event.pointerId)) return
    this.endPointer(event.pointerId, true)
  }

  handleWheel(event) {
    if (!this.canInteract()) return

    event.preventDefault()
    this.orbitCameraController.notifyInteraction()

    const profile = this.resolveInteractionProfile()
    const handler = profile?.wheel ?? null

    const payload = {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      clientX: event.clientX,
      clientY: event.clientY,
      originalEvent: event,
    }

    if (handler) {
      this.callHandler(handler, 'onChange', payload)
      return
    }

    this.orbitCameraController.applyDollyDelta(
      event.deltaY *
        this.settings.wheelDollyDistancePerPixel *
        this.settings.wheelDollySign,
    )
  }

  handleWindowBlur() {
    this.reset()
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.reset()
    }
  }

  beginSingleGesture(x, y, pointerType) {
    this.endPinchGesture(true)
    this.endActiveDrag(true)

    this.singleStart.x = x
    this.singleStart.y = y
    this.singleLast.x = x
    this.singleLast.y = y
    this.singlePointerType = pointerType

    this.state = STATE_SINGLE_PENDING
  }

  beginActiveDrag(axis, x, y) {
    const profile = this.resolveInteractionProfile()
    const handler =
      axis === 'horizontal'
        ? profile?.horizontalDrag ?? null
        : profile?.verticalDrag ?? null

    this.activeDrag = {
      axis,
      handler,
      pointerType: this.singlePointerType,
    }

    this.state =
      axis === 'horizontal'
        ? STATE_SINGLE_HORIZONTAL
        : STATE_SINGLE_VERTICAL

    this.callHandler(handler, 'onStart', {
      axis,
      pointerType: this.singlePointerType,
      startX: this.singleStart.x,
      startY: this.singleStart.y,
      currentX: x,
      currentY: y,
      deltaX: 0,
      deltaY: 0,
      totalDeltaX: 0,
      totalDeltaY: 0,
    })
  }

  createDragPayload(x, y, deltaX, deltaY) {
    return {
      axis: this.activeDrag?.axis ?? null,
      pointerType: this.singlePointerType,
      startX: this.singleStart.x,
      startY: this.singleStart.y,
      currentX: x,
      currentY: y,
      deltaX,
      deltaY,
      totalDeltaX: x - this.singleStart.x,
      totalDeltaY: y - this.singleStart.y,
    }
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

      const axis =
        Math.abs(totalX) >= Math.abs(totalY)
          ? 'horizontal'
          : 'vertical'

      this.beginActiveDrag(axis, x, y)

      const payload = this.createDragPayload(
        x,
        y,
        totalX,
        totalY,
      )

      this.applyDragChange(payload)

      this.singleLast.x = x
      this.singleLast.y = y
      return
    }

    if (!this.activeDrag) return

    const deltaX = x - this.singleLast.x
    const deltaY = y - this.singleLast.y

    this.singleLast.x = x
    this.singleLast.y = y

    this.applyDragChange(
      this.createDragPayload(x, y, deltaX, deltaY),
    )
  }

  applyDragChange(payload) {
    const handler = this.activeDrag?.handler

    if (handler) {
      this.callHandler(handler, 'onChange', payload)
      return
    }

    if (this.activeDrag?.axis === 'horizontal') {
      this.orbitCameraController.applyOrbitDelta(
        payload.deltaX *
          this.settings.orbitRadiansPerPixel *
          this.settings.orbitDragSign,
      )
    }

    // Vertical drag intentionally has no shared camera fallback. It is
    // reserved for simulation-specific interaction when a profile supplies it.
  }

  endActiveDrag(cancelled) {
    if (!this.activeDrag) return

    const handler = this.activeDrag.handler

    this.callHandler(handler, 'onEnd', {
      axis: this.activeDrag.axis,
      pointerType: this.activeDrag.pointerType,
      startX: this.singleStart.x,
      startY: this.singleStart.y,
      currentX: this.singleLast.x,
      currentY: this.singleLast.y,
      totalDeltaX:
        this.singleLast.x - this.singleStart.x,
      totalDeltaY:
        this.singleLast.y - this.singleStart.y,
      cancelled,
    })

    this.activeDrag = null
    this.singlePointerType = null
  }

  canUsePinchGesture() {
    if (this.pointers.size !== 2) return false

    return Array.from(this.pointers.values()).every(
      (pointer) =>
        pointer.pointerType === 'touch' ||
        pointer.pointerType === 'pen',
    )
  }

  beginPinchGesture() {
    const points = Array.from(this.pointers.values())
    if (points.length !== 2) return

    this.state = STATE_PINCH
    this.pinchStartDistance = getDistance(
      points[0],
      points[1],
    )
    this.pinchLastDistance = this.pinchStartDistance

    const profile = this.resolveInteractionProfile()
    this.pinchHandler = profile?.pinch ?? null

    const center = getCenter(points[0], points[1])

    this.callHandler(this.pinchHandler, 'onStart', {
      startDistance: this.pinchStartDistance,
      currentDistance: this.pinchStartDistance,
      distanceDelta: 0,
      totalDistanceDelta: 0,
      centerX: center.x,
      centerY: center.y,
    })
  }

  updatePinchGesture() {
    const points = Array.from(this.pointers.values())
    if (points.length !== 2) return

    const currentDistance = getDistance(
      points[0],
      points[1],
    )

    const distanceDelta =
      currentDistance - this.pinchLastDistance

    const totalDistanceDelta =
      currentDistance - this.pinchStartDistance

    this.pinchLastDistance = currentDistance
    this.orbitCameraController.notifyInteraction()

    const center = getCenter(points[0], points[1])
    const payload = {
      startDistance: this.pinchStartDistance,
      currentDistance,
      distanceDelta,
      totalDistanceDelta,
      centerX: center.x,
      centerY: center.y,
    }

    if (this.pinchHandler) {
      this.callHandler(
        this.pinchHandler,
        'onChange',
        payload,
      )
      return
    }

    this.orbitCameraController.applyDollyDelta(
      distanceDelta *
        this.settings.pinchDollyDistancePerPixel *
        this.settings.pinchDollySign,
    )
  }

  endPinchGesture(cancelled) {
    if (
      this.state !== STATE_PINCH &&
      !this.pinchHandler
    ) {
      this.pinchStartDistance = 0
      this.pinchLastDistance = 0
      return
    }

    this.callHandler(this.pinchHandler, 'onEnd', {
      startDistance: this.pinchStartDistance,
      currentDistance: this.pinchLastDistance,
      totalDistanceDelta:
        this.pinchLastDistance - this.pinchStartDistance,
      cancelled,
    })

    this.pinchHandler = null
    this.pinchStartDistance = 0
    this.pinchLastDistance = 0
  }

  reset() {
    this.endActiveDrag(true)
    this.endPinchGesture(true)

    for (const pointerId of this.pointers.keys()) {
      this.releasePointer(pointerId)
    }

    this.pointers.clear()
    this.endInteractionLock()
    this.state = STATE_IDLE
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

    this.element.removeEventListener(
      'wheel',
      this.handleWheel,
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
