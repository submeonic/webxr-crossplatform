import * as THREE from 'three'

const DEFAULT_COLOR = 0xfff7ae
const DIM_OPACITY = 0.22
const NORMAL_OPACITY = 0.95
const SEGMENT_UP = new THREE.Vector3(0, 1, 0)

export class PinchDragIndicator {
  constructor(scene, camera, options = {}) {
    if (!scene) {
      throw new Error('PinchDragIndicator requires a scene')
    }

    this.scene = scene
    this.camera = camera ?? null

    this.settings = {
      color: options.color ?? DEFAULT_COLOR,
      markerRadius: options.markerRadius ?? 0.012,
      endpointRadius: options.endpointRadius ?? 0.009,
      lineRadius: options.lineRadius ?? 0.0015,
      lineLength: options.lineLength ?? 0.11,
      symbolOffset: options.symbolOffset ?? 0.025,
      maximumVisualDisplacement:
        options.maximumVisualDisplacement ?? 0.16,
    }

    this.axisVector = new THREE.Vector3(0, 1, 0)
    this.origin = new THREE.Vector3()
    this.endpoint = new THREE.Vector3()
    this.positivePosition = new THREE.Vector3()
    this.negativePosition = new THREE.Vector3()
    this.segmentDirection = new THREE.Vector3()
    this.segmentMidpoint = new THREE.Vector3()
    this.segmentQuaternion = new THREE.Quaternion()

    this.group = new THREE.Group()
    this.group.name = 'PinchDragIndicator'
    this.group.visible = false
    this.group.renderOrder = 1000
    this.scene.add(this.group)

    this.originMarker = this.createMarker(
      this.settings.markerRadius,
      0xffffff,
      0.95,
    )
    this.endpointMarker = this.createMarker(
      this.settings.endpointRadius,
      this.settings.color,
      0.95,
    )

    this.guideSegment = this.createSegment(0xffffff, 0.36)
    this.displacementSegment = this.createSegment(
      this.settings.color,
      0.95,
    )

    this.positiveSprite = createTextSprite('+')
    this.negativeSprite = createTextSprite('−')

    this.group.add(
      this.guideSegment,
      this.displacementSegment,
      this.originMarker,
      this.endpointMarker,
      this.positiveSprite,
      this.negativeSprite,
    )
  }

  createMarker(radius, color, opacity) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      }),
    )
    marker.renderOrder = 1001
    return marker
  }

  createSegment(color, opacity) {
    const segment = new THREE.Mesh(
      // Unit-height cylinder aligned to local Y; scale controls length/radius.
      new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      }),
    )
    segment.renderOrder = 1000
    return segment
  }

  show({
    originWorldPosition,
    axisVector,
    positiveLabel = '+',
    negativeLabel = '−',
  }) {
    this.origin.copy(originWorldPosition)
    this.axisVector.copy(axisVector).normalize()

    updateTextSprite(this.positiveSprite, positiveLabel)
    updateTextSprite(this.negativeSprite, negativeLabel)

    this.group.visible = true
    this.originMarker.position.copy(this.origin)
    this.endpointMarker.position.copy(this.origin)

    this.updateGuide()
    this.update({
      axisDisplacementMeters: 0,
      atMinimum: false,
      atMaximum: false,
    })
  }

  update({
    axisDisplacementMeters = 0,
    atMinimum = false,
    atMaximum = false,
  } = {}) {
    if (!this.group.visible) return

    const visualDisplacement = THREE.MathUtils.clamp(
      axisDisplacementMeters,
      -this.settings.maximumVisualDisplacement,
      this.settings.maximumVisualDisplacement,
    )

    this.endpoint
      .copy(this.origin)
      .addScaledVector(this.axisVector, visualDisplacement)

    this.endpointMarker.position.copy(this.endpoint)
    this.updateSegment(
      this.displacementSegment,
      this.origin,
      this.endpoint,
    )

    this.positiveSprite.material.opacity = atMaximum
      ? DIM_OPACITY
      : NORMAL_OPACITY
    this.negativeSprite.material.opacity = atMinimum
      ? DIM_OPACITY
      : NORMAL_OPACITY
  }

  updateGuide() {
    const labelDistance =
      this.settings.lineLength + this.settings.symbolOffset

    const guideStart = this.negativePosition
      .copy(this.origin)
      .addScaledVector(this.axisVector, -this.settings.lineLength)

    const guideEnd = this.positivePosition
      .copy(this.origin)
      .addScaledVector(this.axisVector, this.settings.lineLength)

    this.updateSegment(this.guideSegment, guideStart, guideEnd)

    this.positiveSprite.position
      .copy(this.origin)
      .addScaledVector(this.axisVector, labelDistance)

    this.negativeSprite.position
      .copy(this.origin)
      .addScaledVector(this.axisVector, -labelDistance)
  }

  updateSegment(segment, start, end) {
    this.segmentDirection.copy(end).sub(start)
    const length = this.segmentDirection.length()

    if (length < 0.000001) {
      segment.visible = false
      return
    }

    segment.visible = true
    this.segmentMidpoint.copy(start).add(end).multiplyScalar(0.5)
    this.segmentDirection.multiplyScalar(1 / length)
    this.segmentQuaternion.setFromUnitVectors(
      SEGMENT_UP,
      this.segmentDirection,
    )

    segment.position.copy(this.segmentMidpoint)
    segment.quaternion.copy(this.segmentQuaternion)
    segment.scale.set(
      this.settings.lineRadius,
      length,
      this.settings.lineRadius,
    )
  }

  hide() {
    this.group.visible = false
  }

  dispose() {
    this.scene.remove(this.group)

    for (const child of this.group.children) {
      child.geometry?.dispose?.()
      child.material?.map?.dispose?.()
      child.material?.dispose?.()
    }
  }
}

function createTextSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: NORMAL_OPACITY,
    depthTest: false,
    depthWrite: false,
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(0.055)
  sprite.renderOrder = 1002
  sprite.userData.canvas = canvas

  updateTextSprite(sprite, text)

  return sprite
}

function updateTextSprite(sprite, text) {
  const canvas = sprite.userData.canvas
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 92px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3)

  sprite.material.map.needsUpdate = true
}
