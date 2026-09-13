import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SceneDocumentV1 } from '@yeisme/dsh-pane-protocol'

/**
 * three.js viewport engine behind a disposable face so the React layer can
 * fall back to a scene-tree list when WebGL is unavailable (jsdom, low-end).
 * Meshes stay opaque resourceRefs: the engine renders placeholder box/point
 * geometry per node and never fetches or resolves media/geometry bytes.
 */
export interface Viewport3DEngine {
  setDocument(document: SceneDocumentV1): void
  setSelected(nodeId: string | undefined): void
  /** Shot-convergence emphasis tint; weaker than selection, cleared with an empty set. */
  setEmphasized?(nodeIds: ReadonlySet<string>): void
  dispose(): void
}

export interface CreateViewport3DEngineInput {
  readonly canvas: HTMLCanvasElement
  readonly reducedMotion: boolean
  readonly onSelect?: (nodeId: string) => void
}

export type CreateViewport3DEngine = (input: CreateViewport3DEngineInput) => Viewport3DEngine | undefined

const PLACEHOLDER_COLOR = 0x8b8b94
const SELECTED_COLOR = 0x79b8ff
const EMPHASIZED_COLOR = 0xd9b36c
const POINT_KINDS = new Set(['camera', 'light'])

interface NodeEntry {
  readonly object: THREE.Object3D
  readonly material?: THREE.MeshBasicMaterial | THREE.PointsMaterial
}

function makeLabelSprite(label: string): THREE.Sprite | undefined {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (context === null) return undefined
    context.font = '28px sans-serif'
    context.fillStyle = '#ececf1'
    context.textBaseline = 'middle'
    context.fillText(label.slice(0, 24), 8, 32)
    const texture = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.scale.set(2, 0.5, 1)
    return sprite
  } catch {
    return undefined
  }
}

class ThreeViewport3DEngine implements Viewport3DEngine {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly canvas: HTMLCanvasElement
  private readonly onSelect?: (nodeId: string) => void
  private readonly reducedMotion: boolean
  private nodes = new Map<string, NodeEntry>()
  private selected: string | undefined
  private emphasized: ReadonlySet<string> = new Set()
  private frame = 0
  private disposed = false
  private resizeObserver: ResizeObserver | undefined

  constructor(input: CreateViewport3DEngineInput) {
    this.canvas = input.canvas
    if (input.onSelect !== undefined) this.onSelect = input.onSelect
    this.reducedMotion = input.reducedMotion
    this.renderer = new THREE.WebGLRenderer({ canvas: input.canvas, antialias: true })
    const width = Math.max(input.canvas.clientWidth, 320)
    const height = Math.max(input.canvas.clientHeight, 220)
    this.renderer.setSize(width, height, false)
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500)
    this.camera.position.set(6, 4, 8)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    this.scene.add(new THREE.GridHelper(20, 20, 0x343438, 0x242429))
    this.controls = new OrbitControls(this.camera, input.canvas)
    // Reduced motion: no damping/inertia — the camera only moves with direct input.
    this.controls.enableDamping = !input.reducedMotion
    this.controls.addEventListener('change', this.renderOnDemand)
    input.canvas.addEventListener('click', this.pick)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(input.canvas)
    }
    if (input.reducedMotion) {
      this.renderOnce()
    } else {
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  private readonly tick = (): void => {
    if (this.disposed) return
    this.controls.update()
    this.renderOnce()
    this.frame = requestAnimationFrame(this.tick)
  }

  private readonly renderOnDemand = (): void => {
    if (this.reducedMotion) this.renderOnce()
  }

  private renderOnce(): void {
    if (this.disposed) return
    this.renderer.render(this.scene, this.camera)
  }

  private resize(): void {
    if (this.disposed) return
    const width = Math.max(this.canvas.clientWidth, 320)
    const height = Math.max(this.canvas.clientHeight, 220)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.renderOnce()
  }

  private readonly pick = (event: MouseEvent): void => {
    if (this.disposed || this.onSelect === undefined) return
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.scene.children, true)
    for (const hit of hits) {
      let cursor: THREE.Object3D | null = hit.object
      while (cursor !== null) {
        const nodeId = (cursor.userData as Record<string, unknown>).nodeId
        if (typeof nodeId === 'string') {
          this.onSelect(nodeId)
          return
        }
        cursor = cursor.parent
      }
    }
  }

  setDocument(document: SceneDocumentV1): void {
    if (this.disposed) return
    this.clearNodes()
    const created = new Map<string, THREE.Object3D>()
    for (const node of document.nodes) {
      const object = this.placeholderFor(node.kind, node.label)
      object.userData.nodeId = node.id
      object.position.set(node.transform.translate[0], node.transform.translate[1], node.transform.translate[2])
      object.quaternion.set(node.transform.rotate[0], node.transform.rotate[1], node.transform.rotate[2], node.transform.rotate[3])
      object.scale.set(node.transform.scale[0], node.transform.scale[1], node.transform.scale[2])
      object.visible = node.visible
      created.set(node.id, object)
      this.nodes.set(node.id, {
        object,
        ...(object instanceof THREE.Mesh ? { material: object.material as THREE.MeshBasicMaterial } : {}),
        ...(object instanceof THREE.Points ? { material: object.material as THREE.PointsMaterial } : {}),
      })
    }
    const scene = document.scenes.find(entry => entry.default === true) ?? document.scenes[0]
    for (const node of document.nodes) {
      const object = created.get(node.id)
      if (object === undefined) continue
      const parent = node.parentId !== undefined ? created.get(node.parentId) : undefined
      if (parent !== undefined) parent.add(object)
      else if (scene !== undefined && scene.rootNodeIds.includes(node.id)) this.scene.add(object)
      else this.scene.add(object)
    }
    this.applySelection()
    this.renderOnce()
  }

  private placeholderFor(kind: SceneDocumentV1['nodes'][number]['kind'], label: string): THREE.Object3D {
    let object: THREE.Object3D
    if (POINT_KINDS.has(kind)) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3))
      object = new THREE.Points(geometry, new THREE.PointsMaterial({ color: PLACEHOLDER_COLOR, size: 0.35 }))
    } else if (kind === 'group') {
      object = new THREE.Object3D()
    } else {
      object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: PLACEHOLDER_COLOR, wireframe: true }))
    }
    const sprite = makeLabelSprite(label)
    if (sprite !== undefined) {
      sprite.position.set(0, 0.9, 0)
      object.add(sprite)
    }
    return object
  }

  setSelected(nodeId: string | undefined): void {
    this.selected = nodeId
    this.applySelection()
    this.renderOnce()
  }

  setEmphasized(nodeIds: ReadonlySet<string>): void {
    this.emphasized = nodeIds
    this.applySelection()
    this.renderOnce()
  }

  private applySelection(): void {
    for (const [id, entry] of this.nodes) {
      if (entry.material !== undefined) {
        entry.material.color.setHex(id === this.selected ? SELECTED_COLOR : this.emphasized.has(id) ? EMPHASIZED_COLOR : PLACEHOLDER_COLOR)
      }
    }
  }

  private clearNodes(): void {
    for (const entry of this.nodes.values()) {
      entry.object.removeFromParent()
      entry.object.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry.dispose()
          const material = child.material as THREE.Material | THREE.Material[]
          if (Array.isArray(material)) material.forEach(item => item.dispose())
          else material.dispose()
        }
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose()
          child.material.dispose()
        }
      })
    }
    this.nodes.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('click', this.pick)
    this.controls.removeEventListener('change', this.renderOnDemand)
    this.controls.dispose()
    this.clearNodes()
    this.scene.traverse(child => {
      if (child instanceof THREE.GridHelper) {
        child.geometry.dispose()
        const material = child.material as THREE.Material | THREE.Material[]
        if (Array.isArray(material)) material.forEach(item => item.dispose())
        else material.dispose()
      }
    })
    this.scene.clear()
    this.renderer.dispose()
    try {
      this.renderer.forceContextLoss()
    } catch {
      // Context may already be lost; disposal stays symmetric and idempotent.
    }
  }
}

/**
 * Default engine factory. Returns undefined when WebGL is unavailable so the
 * caller can degrade to the scene-tree fallback view with equal selection.
 */
export const createThreeViewportEngine: CreateViewport3DEngine = input => {
  try {
    return new ThreeViewport3DEngine(input)
  } catch {
    return undefined
  }
}
