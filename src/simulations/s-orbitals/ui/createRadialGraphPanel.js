import * as THREE from 'three'

import {
  RADIAL_GRAPH_LOGICAL_HEIGHT,
  RADIAL_GRAPH_LOGICAL_WIDTH,
  drawRadialGraph,
} from './drawRadialGraph.js'

export function createRadialGraphPanel({
  samples,
  graphConfig,
  widthMeters = 1.5,
  heightMeters = 0.84,
} = {}) {
  if (!samples) {
    throw new Error('createRadialGraphPanel requires samples')
  }

  const renderScale = 2
  const canvas = document.createElement('canvas')

  canvas.width = RADIAL_GRAPH_LOGICAL_WIDTH * renderScale
  canvas.height = RADIAL_GRAPH_LOGICAL_HEIGHT * renderScale

  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const geometry = new THREE.PlaneGeometry(
    widthMeters,
    heightMeters,
  )

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'RadialProbabilityGraphPanel'
  mesh.renderOrder = 0
  mesh.frustumCulled = false

  let latestState = {
    orbitalType: graphConfig?.activeDatasetId ?? '1s',
    innerRadiusA0: 0,
    outerRadiusA0: 0,
    highlightedCount: 0,
    totalCount: samples.count,
  }

  function update(state = {}) {
    latestState = {
      ...latestState,
      ...state,
    }

    draw()
    texture.needsUpdate = true
  }

  function draw() {
    ctx.save()
    ctx.setTransform(
      renderScale,
      0,
      0,
      renderScale,
      0,
      0,
    )

    drawRadialGraph(ctx, {
      state: latestState,
      graphConfig,
      width: RADIAL_GRAPH_LOGICAL_WIDTH,
      height: RADIAL_GRAPH_LOGICAL_HEIGHT,
    })

    ctx.restore()
  }

  function setVisible(visible) {
    mesh.visible = visible
  }

  function dispose() {
    texture.dispose()
    material.dispose()
    geometry.dispose()
  }

  update()

  return {
    mesh,
    canvas,
    texture,
    update,
    setVisible,
    dispose,
  }
}
