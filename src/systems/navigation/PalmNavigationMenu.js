import * as THREE from 'three'

const TEMP_POINTER_LOCAL = new THREE.Vector3()

const PANEL_LOGICAL_WIDTH = 600
const PANEL_LOGICAL_HEIGHT = 400
const BUTTON_LOGICAL_WIDTH = 512
const BUTTON_LOGICAL_HEIGHT = 256
const RENDER_SCALE = 2

const FONT_DISPLAY = '"Agency FB", Impact, "Arial Narrow", sans-serif'
const FONT_BODY = '"Bai Jamjuree", Arial, Helvetica, sans-serif'

const COLORS = {
  background: '#121212',
  backgroundSoft: 'rgba(255, 255, 255, 0.045)',
  backgroundHover: 'rgba(255, 247, 174, 0.12)',
  backgroundActive: 'rgba(110, 207, 127, 0.18)',
  backgroundPressed: 'rgba(255, 247, 174, 0.22)',
  backgroundExitHover: 'rgba(255, 126, 145, 0.14)',
  backgroundExitPressed: 'rgba(255, 126, 145, 0.24)',
  brand: '#fff7ae',
  green: '#6ecf7f',
  text: '#ffffff',
  mutedText: 'rgba(255, 255, 255, 0.68)',
  disabledText: 'rgba(255, 255, 255, 0.38)',
  line: 'rgba(255, 255, 255, 0.14)',
  lineStrong: 'rgba(255, 255, 255, 0.72)',
  exit: '#ff8a9c',
}

function disposeObject3D(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.()

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (!material) continue

      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose()
      }

      material.dispose?.()
    }
  })
}

function drawRect(ctx, x, y, width, height, options = {}) {
  ctx.save()

  if (options.fillStyle) {
    ctx.fillStyle = options.fillStyle
    ctx.fillRect(x, y, width, height)
  }

  if (options.strokeStyle) {
    const lineWidth = options.lineWidth ?? 1

    ctx.strokeStyle = options.strokeStyle
    ctx.lineWidth = lineWidth
    ctx.strokeRect(
      x + lineWidth * 0.5,
      y + lineWidth * 0.5,
      width - lineWidth,
      height - lineWidth,
    )
  }

  ctx.restore()
}

function createCanvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

export class PalmNavigationMenu {
  constructor(scene, options = {}) {
    if (!scene) {
      throw new Error('PalmNavigationMenu requires a scene')
    }

    this.scene = scene

    this.settings = {
      width: 0.205,
      height: 0.137,

      navigationButtonWidth: 0.046,
      navigationButtonHeight: 0.031,
      navigationButtonGap: 0.008,

      exitButtonWidth: 0.112,
      exitButtonHeight: 0.025,

      hoverDistance: 0.065,
      releasePlaneZ: 0.022,
      backTolerance: 0.014,
      pointerRadius: 0.0038,

      // Buttons sit slightly in front of the backing plane and travel
      // backward toward it as the fingertip presses inward.
      buttonRestZ: 0.0048,
      buttonMaxTravel: 0.0038,
      buttonPressStartZ: 0.014,
      buttonPressEndZ: 0.003,
      buttonActivationProgress: 0.82,

      ...options,
    }

    this.group = new THREE.Group()
    this.group.name = 'PalmNavigationMenu'
    this.group.visible = false
    this.scene.add(this.group)

    this.panelCanvas = document.createElement('canvas')
    this.panelCanvas.width = PANEL_LOGICAL_WIDTH * RENDER_SCALE
    this.panelCanvas.height = PANEL_LOGICAL_HEIGHT * RENDER_SCALE
    this.panelContext = this.panelCanvas.getContext('2d')

    this.panelTexture = createCanvasTexture(this.panelCanvas)
    this.panelMaterial = new THREE.MeshBasicMaterial({
      map: this.panelTexture,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    })

    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(
        this.settings.width,
        this.settings.height,
      ),
      this.panelMaterial,
    )
    this.panel.name = 'PalmNavigationMenu_Panel'
    this.group.add(this.panel)

    this.buttonGroup = new THREE.Group()
    this.buttonGroup.name = 'PalmNavigationMenu_Buttons'
    this.group.add(this.buttonGroup)

    this.pointer = this.createPointer()
    this.group.add(this.pointer)

    this.buttons = []
    this.navigationItems = []
    this.activeSimulationId = null

    this.interaction = {
      activeButton: null,
      lockedButton: null,
      previousPressProgress: 0,
      armed: false,
    }

    this.drawPanel()
    this.setItems([])
  }

  createPointer() {
    const group = new THREE.Group()
    group.name = 'PalmNavigationMenu_Pointer'
    group.visible = false

    const sharedMaterialSettings = {
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        this.settings.pointerRadius * 0.64,
        this.settings.pointerRadius,
        40,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xfff7ae,
        opacity: 0.95,
        ...sharedMaterialSettings,
      }),
    )

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(
        this.settings.pointerRadius * 0.22,
        28,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 1,
        ...sharedMaterialSettings,
      }),
    )
    dot.position.z = 0.0002

    group.add(ring)
    group.add(dot)

    return group
  }

  drawPanel() {
    const ctx = this.panelContext

    ctx.save()
    ctx.setTransform(
      RENDER_SCALE,
      0,
      0,
      RENDER_SCALE,
      0,
      0,
    )
    ctx.clearRect(
      0,
      0,
      PANEL_LOGICAL_WIDTH,
      PANEL_LOGICAL_HEIGHT,
    )

    ctx.fillStyle = COLORS.background
    ctx.fillRect(
      0,
      0,
      PANEL_LOGICAL_WIDTH,
      PANEL_LOGICAL_HEIGHT,
    )

    drawRect(
      ctx,
      1,
      1,
      PANEL_LOGICAL_WIDTH - 2,
      PANEL_LOGICAL_HEIGHT - 2,
      {
        strokeStyle: COLORS.lineStrong,
        lineWidth: 2,
      },
    )

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.brand
    ctx.font = `bold 43px ${FONT_DISPLAY}`
    ctx.fillText(
      'SIMULATIONS',
      PANEL_LOGICAL_WIDTH * 0.5,
      54,
    )

    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(42, 89)
    ctx.lineTo(PANEL_LOGICAL_WIDTH - 42, 89)
    ctx.stroke()

    ctx.fillStyle = COLORS.mutedText
    ctx.font = `600 18px ${FONT_BODY}`
    ctx.fillText(
      'Press with opposite index finger',
      PANEL_LOGICAL_WIDTH * 0.5,
      PANEL_LOGICAL_HEIGHT - 20,
    )

    ctx.restore()
    this.panelTexture.needsUpdate = true
  }

  setItems(items = []) {
    this.navigationItems = [...items]
    this.clearButtons()
    this.resetInteraction({ redraw: false })

    const navigationItems = this.navigationItems.filter(
      (item) => item.kind !== 'exit',
    )

    const buttonWidth = this.settings.navigationButtonWidth
    const gap = this.settings.navigationButtonGap
    const totalWidth =
      navigationItems.length * buttonWidth +
      Math.max(0, navigationItems.length - 1) * gap

    navigationItems.forEach((item, index) => {
      const x =
        -totalWidth * 0.5 +
        buttonWidth * 0.5 +
        index * (buttonWidth + gap)

      this.buttons.push(this.createButton(item, {
        x,
        y: 0.011,
        width: buttonWidth,
        height: this.settings.navigationButtonHeight,
      }))
    })

    const exitItem =
      this.navigationItems.find((item) => item.kind === 'exit') ??
      {
        id: 'exit-xr',
        label: 'EXIT XR',
        kind: 'exit',
      }

    this.buttons.push(this.createButton(exitItem, {
      x: 0,
      y: -0.043,
      width: this.settings.exitButtonWidth,
      height: this.settings.exitButtonHeight,
    }))

    this.refreshButtonVisuals()
  }

  clearButtons() {
    for (const button of this.buttons) {
      this.buttonGroup.remove(button.mesh)
      button.mesh.geometry.dispose()
      button.material.dispose()
      button.texture.dispose()
    }

    this.buttons = []
  }

  createButton(item, layout) {
    const canvas = document.createElement('canvas')
    canvas.width = BUTTON_LOGICAL_WIDTH * RENDER_SCALE
    canvas.height = BUTTON_LOGICAL_HEIGHT * RENDER_SCALE

    const texture = createCanvasTexture(canvas)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    })

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.width, layout.height),
      material,
    )
    mesh.name = `PalmNavigationMenu_Button_${item.id}`
    mesh.position.set(
      layout.x,
      layout.y,
      this.settings.buttonRestZ,
    )
    this.buttonGroup.add(mesh)

    return {
      item,
      layout,
      canvas,
      context: canvas.getContext('2d'),
      texture,
      material,
      mesh,
      hovered: false,
      pressed: false,
      disabled: false,
      active: false,
      pressProgress: 0,
    }
  }

  setVisible(visible) {
    const nextVisible = Boolean(visible)

    if (this.group.visible === nextVisible) return

    this.group.visible = nextVisible

    if (!nextVisible) {
      this.resetInteraction()
      this.pointer.visible = false
    }
  }

  setTransform(position, quaternion) {
    this.group.position.copy(position)
    this.group.quaternion.copy(quaternion)
    this.group.updateMatrixWorld(true)
  }

  setActiveSimulationId(simulationId) {
    if (this.activeSimulationId === simulationId) return

    this.activeSimulationId = simulationId
    this.refreshButtonVisuals()
  }

  refreshButtonVisuals() {
    for (const button of this.buttons) {
      button.active =
        button.item.kind === 'simulation' &&
        button.item.id === this.activeSimulationId

      button.disabled = Boolean(
        button.item.disabled || button.active,
      )

      this.drawButton(button)
    }
  }

  getButtonColors(button) {
    const isExit = button.item.kind === 'exit'

    if (button.pressed) {
      return isExit
        ? {
            fill: COLORS.backgroundExitPressed,
            border: COLORS.exit,
            text: '#ffffff',
          }
        : {
            fill: COLORS.backgroundPressed,
            border: COLORS.brand,
            text: COLORS.brand,
          }
    }

    if (button.active) {
      return {
        fill: COLORS.backgroundActive,
        border: COLORS.green,
        text: COLORS.green,
      }
    }

    if (button.hovered) {
      return isExit
        ? {
            fill: COLORS.backgroundExitHover,
            border: COLORS.exit,
            text: COLORS.exit,
          }
        : {
            fill: COLORS.backgroundHover,
            border: COLORS.brand,
            text: COLORS.brand,
          }
    }

    if (button.disabled) {
      return {
        fill: COLORS.backgroundSoft,
        border: COLORS.line,
        text: COLORS.disabledText,
      }
    }

    return {
      fill: COLORS.backgroundSoft,
      border: 'rgba(255, 255, 255, 0.34)',
      text: COLORS.text,
    }
  }

  drawButton(button) {
    const ctx = button.context
    const colors = this.getButtonColors(button)

    ctx.save()
    ctx.setTransform(
      RENDER_SCALE,
      0,
      0,
      RENDER_SCALE,
      0,
      0,
    )
    ctx.clearRect(
      0,
      0,
      BUTTON_LOGICAL_WIDTH,
      BUTTON_LOGICAL_HEIGHT,
    )

    drawRect(
      ctx,
      1,
      1,
      BUTTON_LOGICAL_WIDTH - 2,
      BUTTON_LOGICAL_HEIGHT - 2,
      {
        fillStyle: colors.fill,
        strokeStyle: colors.border,
        lineWidth:
          button.hovered || button.active || button.pressed
            ? 8
            : 5,
      },
    )

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.text
    ctx.font = button.item.kind === 'exit'
      ? `700 62px ${FONT_BODY}`
      : `bold 112px ${FONT_DISPLAY}`

    ctx.fillText(
      button.item.label,
      BUTTON_LOGICAL_WIDTH * 0.5,
      BUTTON_LOGICAL_HEIGHT * 0.52,
    )

    ctx.restore()
    button.texture.needsUpdate = true
  }

  setButtonPressProgress(button, progress) {
    const nextProgress = THREE.MathUtils.clamp(
      Number.isFinite(progress) ? progress : 0,
      0,
      1,
    )

    button.pressProgress = nextProgress
    button.mesh.position.z =
      this.settings.buttonRestZ -
      this.settings.buttonMaxTravel * nextProgress

    const nextPressed = nextProgress > 0.08

    if (button.pressed !== nextPressed) {
      button.pressed = nextPressed
      this.drawButton(button)
    }
  }

  resetButtonTravel(exceptButton = null) {
    for (const button of this.buttons) {
      if (button === exceptButton) continue
      this.setButtonPressProgress(button, 0)
    }
  }

  calculatePressProgress(pointerZ) {
    const start = this.settings.buttonPressStartZ
    const end = this.settings.buttonPressEndZ

    if (start <= end) return 0

    return THREE.MathUtils.clamp(
      (start - pointerZ) / (start - end),
      0,
      1,
    )
  }

  resetInteraction({ redraw = true } = {}) {
    this.interaction.activeButton = null
    this.interaction.lockedButton = null
    this.interaction.previousPressProgress = 0
    this.interaction.armed = false

    let visualChanged = false

    for (const button of this.buttons) {
      if (button.hovered) visualChanged = true
      button.hovered = false
      this.setButtonPressProgress(button, 0)
    }

    if (redraw && visualChanged) {
      for (const button of this.buttons) {
        this.drawButton(button)
      }
    }
  }

  getButtonAtLocalPoint(point) {
    for (const button of this.buttons) {
      const halfWidth = button.layout.width * 0.5
      const halfHeight = button.layout.height * 0.5

      if (
        point.x >= button.layout.x - halfWidth &&
        point.x <= button.layout.x + halfWidth &&
        point.y >= button.layout.y - halfHeight &&
        point.y <= button.layout.y + halfHeight
      ) {
        return button
      }
    }

    return null
  }

  updateHoverStates(hitButton) {
    for (const button of this.buttons) {
      const nextHovered = button === hitButton

      if (button.hovered !== nextHovered) {
        button.hovered = nextHovered
        this.drawButton(button)
      }
    }
  }

  releaseLockedButton() {
    const lockedButton = this.interaction.lockedButton

    if (lockedButton) {
      this.setButtonPressProgress(lockedButton, 0)
    }

    this.interaction.lockedButton = null
    this.interaction.activeButton = null
    this.interaction.previousPressProgress = 0
    this.interaction.armed = false
  }

  updatePointer(pointerWorldPosition, interactionEnabled = true) {
    if (!this.group.visible || !pointerWorldPosition) {
      this.pointer.visible = false
      this.resetInteraction()
      return null
    }

    this.group.updateMatrixWorld(true)

    TEMP_POINTER_LOCAL.copy(pointerWorldPosition)
    this.group.worldToLocal(TEMP_POINTER_LOCAL)

    const withinDepth =
      TEMP_POINTER_LOCAL.z <= this.settings.hoverDistance &&
      TEMP_POINTER_LOCAL.z >= -this.settings.backTolerance

    const withinPanel =
      Math.abs(TEMP_POINTER_LOCAL.x) <=
        this.settings.width * 0.5 + 0.012 &&
      Math.abs(TEMP_POINTER_LOCAL.y) <=
        this.settings.height * 0.5 + 0.012

    this.pointer.visible = withinDepth && withinPanel

    if (this.pointer.visible) {
      this.pointer.position.set(
        TEMP_POINTER_LOCAL.x,
        TEMP_POINTER_LOCAL.y,
        TEMP_POINTER_LOCAL.z + 0.0005,
      )
    }

    const hitButton = withinDepth
      ? this.getButtonAtLocalPoint(TEMP_POINTER_LOCAL)
      : null

    this.updateHoverStates(hitButton)

    const lockedButton = this.interaction.lockedButton

    if (lockedButton) {
      const stillInside = hitButton === lockedButton
      const releasedForward =
        TEMP_POINTER_LOCAL.z >= this.settings.releasePlaneZ

      if (!stillInside || releasedForward) {
        this.releaseLockedButton()
        return null
      }

      const pressProgress = lockedButton.disabled
        ? 0
        : this.calculatePressProgress(TEMP_POINTER_LOCAL.z)

      this.setButtonPressProgress(
        lockedButton,
        Math.max(
          pressProgress,
          this.settings.buttonActivationProgress,
        ),
      )

      return null
    }

    if (!hitButton) {
      this.interaction.activeButton = null
      this.interaction.previousPressProgress = 0
      this.interaction.armed = false
      this.resetButtonTravel()
      return null
    }

    if (this.interaction.activeButton !== hitButton) {
      this.interaction.activeButton = hitButton
      this.interaction.previousPressProgress = 0
      this.interaction.armed =
        TEMP_POINTER_LOCAL.z >=
        this.settings.buttonPressStartZ
      this.resetButtonTravel(hitButton)
    }

    if (
      TEMP_POINTER_LOCAL.z >=
      this.settings.buttonPressStartZ
    ) {
      this.interaction.armed = true
    }

    const pressProgress = hitButton.disabled
      ? 0
      : this.calculatePressProgress(TEMP_POINTER_LOCAL.z)

    this.setButtonPressProgress(hitButton, pressProgress)

    const crossedActivationPoint =
      this.interaction.previousPressProgress <
        this.settings.buttonActivationProgress &&
      pressProgress >=
        this.settings.buttonActivationProgress

    this.interaction.previousPressProgress = pressProgress

    if (
      interactionEnabled &&
      this.interaction.armed &&
      crossedActivationPoint &&
      !hitButton.disabled
    ) {
      this.interaction.lockedButton = hitButton
      this.interaction.armed = false
      this.setButtonPressProgress(
        hitButton,
        Math.max(
          pressProgress,
          this.settings.buttonActivationProgress,
        ),
      )
      return hitButton.item
    }

    return null
  }

  dispose() {
    this.scene.remove(this.group)
    disposeObject3D(this.group)
  }
}
