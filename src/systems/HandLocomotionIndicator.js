import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function createArrowTexture(symbol, active = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 256, 256)

  ctx.font = '150px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.shadowColor = active
    ? 'rgba(90, 220, 255, 1.0)'
    : 'rgba(90, 220, 255, 0.45)'

  ctx.shadowBlur = active ? 24 : 10

  ctx.fillStyle = active
    ? 'rgba(235, 252, 255, 1.0)'
    : 'rgba(170, 230, 245, 0.75)'

  ctx.fillText(symbol, 128, 138)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  return texture
}

function makeGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xbfd8e6,

    transparent: true,
    opacity: 0.22,

    roughness: 0.22,
    metalness: 0.0,

    clearcoat: 1.0,
    clearcoatRoughness: 0.08,

    emissive: 0x114455,
    emissiveIntensity: 0.08,

    depthWrite: false,
    side: THREE.DoubleSide
  })
}

function cloneSceneWithMaterial(sourceScene, material) {
  const clone = sourceScene.clone(true)

  clone.traverse((child) => {
    if (!child.isMesh) return

    child.material = material.clone()
    child.castShadow = false
    child.receiveShadow = false
    child.renderOrder = 20
    child.frustumCulled = false
  })

  return clone
}

function getProjectedRadiusXZ(object) {
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)

  if (box.isEmpty()) return 1

  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z)
  ]

  let maxRadius = 0

  for (const corner of corners) {
    const radius = Math.sqrt(
      corner.x * corner.x +
      corner.z * corner.z
    )

    maxRadius = Math.max(maxRadius, radius)
  }

  return Math.max(maxRadius, 0.0001)
}

export class HandLocomotionIndicator {
  constructor(parent, options = {}) {
    this.parent = parent

    this.options = {
      modelPath: '/models/dpad_wedge.glb',

      /*
      Full D-pad size in meters.
      */
      dpadDiameter: 0.07,

      /*
      Offset from neutral thumb anchor in hand-local meters.
      */
      offsetX: 0.0,
      offsetY: 0.0,
      offsetZ: 0.0,

      pressDepth: 0.001,
      activeScale: 0.965,

      /*
      Your wedge mesh needed a 180° local Y rotation while
      the arrows stayed in the correct slots.
      */
      assetRotationY: Math.PI,

      arrowLift: 0.0001,
      centerRingLift: 0.0001,
      centerDotLift: 0.0002,

      ...options
    }

    /*
    Indicator local coordinate system:

      X = left/right
      Y = face normal / press direction
      Z = forward/back

    D-pad lies on XZ and faces +Y.
    */
    this.group = new THREE.Group()
    this.group.name = 'HandLocomotionIndicator'
    this.group.visible = false

    this.parent.add(this.group)

    this.buttons = {}

    /*
    Key solve:
    Use the same arrow texture for each button and let the
    button-group Y rotation define direction.
    */
    this.arrowTextures = {
      forwardInactive: createArrowTexture('▽', false),
      forwardActive: createArrowTexture('▽', true),

      backInactive: createArrowTexture('▽', false),
      backActive: createArrowTexture('▽', true),

      leftInactive: createArrowTexture('▽', false),
      leftActive: createArrowTexture('▽', true),

      rightInactive: createArrowTexture('▽', false),
      rightActive: createArrowTexture('▽', true)
    }

    this.tempAnchor = new THREE.Vector3()
    this.tempMatrix = new THREE.Matrix4()

    this.colorInactive = new THREE.Color(0xbfd8e6)
    this.colorActive = new THREE.Color(0xdff8ff)

    this.emissiveInactive = new THREE.Color(0x114455)
    this.emissiveActive = new THREE.Color(0x33ccff)

    this.loadModel()
  }

  loadModel() {
    const loader = new GLTFLoader()

    loader.load(
      this.options.modelPath,

      (gltf) => {
        this.sourceScene = gltf.scene
        this.sourceScene.updateMatrixWorld(true)

        const sourceRadius =
          getProjectedRadiusXZ(this.sourceScene)

        /*
        The wedge origin is the center of the complete D-pad.
        sourceRadius * 2 is approximately full D-pad diameter.
        */
        this.assetScale =
          this.options.dpadDiameter / (sourceRadius * 2.0)

        this.createButtonsFromModel()
      },

      undefined,

      (error) => {
        console.warn(
          '[HandLocomotionIndicator] Failed to load GLB. Using fallback.',
          error
        )

        this.createFallbackButtons()
      }
    )
  }

  createButtonsFromModel() {
    const directions = [
      {
        name: 'forward',
        rotationY: 0,
        arrow: 'forward'
      },
      {
        name: 'right',
        rotationY: -Math.PI / 2,
        arrow: 'right'
      },
      {
        name: 'back',
        rotationY: Math.PI,
        arrow: 'back'
      },
      {
        name: 'left',
        rotationY: Math.PI / 2,
        arrow: 'left'
      }
    ]

    for (const direction of directions) {
      const buttonGroup = new THREE.Group()
      buttonGroup.name = `${direction.name}Button`

      /*
      Buttons rotate around Y because the D-pad lies on XZ.
      */
      buttonGroup.rotation.y = direction.rotationY

      const assetRoot = new THREE.Group()
      assetRoot.name = `${direction.name}AssetRoot`

      assetRoot.rotation.set(
        0,
        this.options.assetRotationY,
        0
      )

      assetRoot.scale.setScalar(this.assetScale)

      const material = makeGlassMaterial()
      const model = cloneSceneWithMaterial(
        this.sourceScene,
        material
      )

      assetRoot.add(model)
      buttonGroup.add(assetRoot)

      const arrow = this.createArrowPlane(direction.arrow)

      arrow.position.set(
        0,
        this.options.arrowLift,
        this.options.dpadDiameter * 0.34
      )

      buttonGroup.add(arrow)

      this.group.add(buttonGroup)

      this.buttons[direction.name] = {
        group: buttonGroup,
        assetRoot,
        model,
        arrow,
        arrowName: direction.arrow,
        currentPress: 0,
        targetPress: 0
      }
    }

    this.createCenterMarker()
  }

  createFallbackButtons() {
    const radiusOuter = this.options.dpadDiameter * 0.5
    const radiusInner = this.options.dpadDiameter * 0.25

    const baseGeometry = new THREE.RingGeometry(
      radiusInner,
      radiusOuter,
      16,
      1,
      Math.PI * 0.25,
      Math.PI * 0.5
    )

    /*
    RingGeometry starts in XY facing +Z.
    Rotate to XZ facing +Y.
    */
    baseGeometry.rotateX(-Math.PI / 2)

    const directions = [
      {
        name: 'forward',
        rotationY: Math.PI * 0.25,
        arrow: 'forward'
      },
      {
        name: 'right',
        rotationY: -Math.PI * 0.25,
        arrow: 'right'
      },
      {
        name: 'back',
        rotationY: -Math.PI * 0.75,
        arrow: 'back'
      },
      {
        name: 'left',
        rotationY: Math.PI * 0.75,
        arrow: 'left'
      }
    ]

    for (const direction of directions) {
      const buttonGroup = new THREE.Group()
      buttonGroup.name = `${direction.name}Button`
      buttonGroup.rotation.y = direction.rotationY

      const mesh = new THREE.Mesh(
        baseGeometry.clone(),
        makeGlassMaterial()
      )

      mesh.renderOrder = 20
      buttonGroup.add(mesh)

      const arrow = this.createArrowPlane(direction.arrow)

      arrow.position.set(
        0,
        this.options.arrowLift,
        this.options.dpadDiameter * 0.34
      )

      buttonGroup.add(arrow)

      this.group.add(buttonGroup)

      this.buttons[direction.name] = {
        group: buttonGroup,
        mesh,
        arrow,
        arrowName: direction.arrow,
        currentPress: 0,
        targetPress: 0
      }
    }

    this.createCenterMarker()
  }

  createArrowPlane(directionName) {
    const texture =
      this.arrowTextures[`${directionName}Inactive`]

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    const size = this.options.dpadDiameter * 0.18

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      material
    )

    /*
    PlaneGeometry starts in XY facing +Z.
    Rotate to XZ facing +Y.
    */
    mesh.rotation.x = -Math.PI / 2

    mesh.name = `${directionName}Arrow`
    mesh.renderOrder = 30

    return mesh
  }

  createCenterMarker() {
    const centerGroup = new THREE.Group()
    centerGroup.name = 'NeutralMarker'

    const ringGeometry = new THREE.RingGeometry(
      this.options.dpadDiameter * 0.055,
      this.options.dpadDiameter * 0.07,
      48
    )

    const dotGeometry = new THREE.CircleGeometry(
      this.options.dpadDiameter * 0.018,
      32
    )

    ringGeometry.rotateX(-Math.PI / 2)
    dotGeometry.rotateX(-Math.PI / 2)

    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x99eaff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    )

    const dot = new THREE.Mesh(
      dotGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xdff8ff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    )

    ring.position.y = this.options.centerRingLift
    dot.position.y = this.options.centerDotLift

    ring.renderOrder = 25
    dot.renderOrder = 26

    centerGroup.add(ring)
    centerGroup.add(dot)

    this.group.add(centerGroup)
  }

  update({ activeHand, direction, dpadDirection, deltaTime }) {
    /*
    dpadDirection is accepted as a backward-compatible alias.
    */
    const resolvedDirection =
      direction ?? dpadDirection ?? 'none'

    if (!activeHand || !activeHand.fistActive) {
      this.group.visible = false
      return
    }

    this.group.visible = true

    this.updateTransform(activeHand)
    this.updateActiveDirection(resolvedDirection)
    this.updatePressAnimation(deltaTime)
  }

  updateTransform(activeHand) {
    const anchor = this.tempAnchor

    anchor.copy(activeHand.localOrigin)

    anchor.addScaledVector(
      activeHand.localXAxis,
      activeHand.neutralThumbLocal.x * activeHand.handScale
    )

    anchor.addScaledVector(
      activeHand.localYAxis,
      activeHand.neutralThumbLocal.y * activeHand.handScale
    )

    anchor.addScaledVector(
      activeHand.localZAxis,
      activeHand.neutralThumbLocal.z * activeHand.handScale
    )

    anchor.addScaledVector(
      activeHand.localXAxis,
      this.options.offsetX
    )

    anchor.addScaledVector(
      activeHand.localYAxis,
      this.options.offsetY
    )

    anchor.addScaledVector(
      activeHand.localZAxis,
      this.options.offsetZ
    )

    this.group.position.copy(anchor)

    /*
    Indicator local X = hand local X
    Indicator local Y = hand local Y
    Indicator local Z = corrected hand local Z

    Rebuild an orthonormal basis to avoid scaling/shearing.
    */
    const rawX = activeHand.localXAxis.clone().normalize()
    const rawY = activeHand.localYAxis.clone().normalize()

    const zAxis = new THREE.Vector3()
      .crossVectors(rawX, rawY)
      .normalize()

    const xAxis = new THREE.Vector3()
      .crossVectors(rawY, zAxis)
      .normalize()

    const yAxis = rawY

    this.tempMatrix.makeBasis(
      xAxis,
      yAxis,
      zAxis
    )

    this.group.quaternion.setFromRotationMatrix(this.tempMatrix)
  }

  updateActiveDirection(direction) {
    const activeButton =
      direction === 'forward'
        ? 'forward'
        : direction === 'back'
          ? 'back'
          : direction === 'turn-left' || direction === 'strafe-left'
            ? 'left'
            : direction === 'turn-right' || direction === 'strafe-right'
              ? 'right'
              : null

    for (const [name, button] of Object.entries(this.buttons)) {
      button.targetPress = activeButton === name ? 1 : 0
    }
  }

  updatePressAnimation(deltaTime) {
    const t = 1.0 - Math.exp(-14.0 * deltaTime)

    for (const button of Object.values(this.buttons)) {
      button.currentPress = THREE.MathUtils.lerp(
        button.currentPress,
        button.targetPress,
        t
      )

      const p = button.currentPress

      /*
      Press along local Y because the D-pad faces +Y.
      */
      button.group.position.y =
        -this.options.pressDepth * p

      const scale = THREE.MathUtils.lerp(
        1.0,
        this.options.activeScale,
        p
      )

      button.group.scale.setScalar(scale)

      const arrowMaterial = button.arrow.material

      arrowMaterial.map =
        p > 0.5
          ? this.arrowTextures[`${button.arrowName}Active`]
          : this.arrowTextures[`${button.arrowName}Inactive`]

      arrowMaterial.opacity =
        THREE.MathUtils.lerp(0.72, 1.0, p)

      arrowMaterial.needsUpdate = true

      button.group.traverse((child) => {
        if (!child.isMesh) return
        if (!child.material) return
        if (child === button.arrow) return
        if (!child.material.isMeshPhysicalMaterial) return

        child.material.opacity =
          THREE.MathUtils.lerp(0.22, 0.48, p)

        child.material.emissiveIntensity =
          THREE.MathUtils.lerp(0.08, 0.45, p)

        child.material.color.lerpColors(
          this.colorInactive,
          this.colorActive,
          p
        )

        child.material.emissive.lerpColors(
          this.emissiveInactive,
          this.emissiveActive,
          p
        )
      })
    }
  }
}