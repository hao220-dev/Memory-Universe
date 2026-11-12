import * as THREE from 'three'
import gsap from 'gsap'
import { ResourceManager } from '../core/ResourceManager'
import { SceneManager } from '../core/SceneManager'
import { CameraManager } from '../core/CameraManager'
import { RendererManager, type QualityLevel } from '../core/RendererManager'
import { CameraControls } from '../core/CameraControls'
import { StarParticles } from '../systems/StarParticles'
import { Galaxy } from '../systems/Galaxy'
import { Planet } from '../systems/Planet'
import { PhotoCard, type PhotoCardTextures } from './PhotoCard'
import { PhotoTextureCache } from './PhotoTextureCache'
import { computePhotoLayout } from './PhotoLayouts'
import type { PhotoLayoutMode, PhotoWallItem } from './types'

const HOME_POSITION = new THREE.Vector3(0, 4.2, 40)
const HOME_TARGET = new THREE.Vector3(0, 0, -18)
const INTRO_POSITION = new THREE.Vector3(0, 15, 76)
/** 记忆星球与照片整体绕中心匀速转动的角速度（弧度/秒）。 */
const CLUSTER_ROTATION_SPEED = 0.06

export interface PhotoUniverseEngineOptions {
  quality?: QualityLevel | 'auto'
  layout?: PhotoLayoutMode
  onSelect?: (photo: PhotoWallItem) => void
  onDeselect?: () => void
  onReady?: () => void
  onUnavailable?: (reason: string) => void
  onContextLost?: () => void
  onContextRestored?: () => void
}

interface CameraRestoreState {
  position: THREE.Vector3
  target: THREE.Vector3
}

function createGlowTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(160, 225, 255, 0.9)')
    gradient.addColorStop(0.28, 'rgba(80, 165, 250, 0.42)')
    gradient.addColorStop(0.62, 'rgba(140, 90, 246, 0.12)')
    gradient.addColorStop(1, 'rgba(5, 8, 22, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createPlaceholderTexture(kind: 'loading' | 'error'): THREE.CanvasTexture {
  const width = 512
  const height = 384
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, kind === 'error' ? '#170d1f' : '#0a1428')
    gradient.addColorStop(1, '#050816')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = kind === 'error' ? 'rgba(248, 113, 113, 0.22)' : 'rgba(56, 189, 248, 0.18)'
    ctx.lineWidth = 1
    for (let x = 32; x < width; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 32; y < height; y += 48) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.strokeStyle = kind === 'error' ? 'rgba(248, 113, 113, 0.7)' : 'rgba(125, 211, 252, 0.65)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(width / 2, height / 2 - 24, 44, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = kind === 'error' ? 'rgba(248, 113, 113, 0.9)' : 'rgba(125, 211, 252, 0.9)'
    ctx.font = '600 20px "Space Grotesk", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(kind === 'error' ? 'SIGNAL LOST' : 'LOADING MEMORY', width / 2, height / 2 + 62)

    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'
    ctx.font = '400 14px "Space Grotesk", sans-serif'
    ctx.fillText('MEMORY UNIVERSE', width / 2, height / 2 + 94)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 3D 照片墙引擎：中央星球 + 照片卡片布局 + 拾取 / 相机聚焦 / 纹理分级加载。
 * 只接收 DOM 容器与纯数据，不依赖 Vue / Pinia / Router。
 */
export class PhotoUniverseEngine {
  private readonly container: HTMLElement
  private readonly options: PhotoUniverseEngineOptions
  private readonly resources = new ResourceManager()
  private readonly textures = new PhotoTextureCache()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly clock = new THREE.Clock()

  private sceneManager: SceneManager | null = null
  private cameraManager: CameraManager | null = null
  private rendererManager: RendererManager | null = null
  private controls: CameraControls | null = null

  private stars: StarParticles | null = null
  private galaxy: Galaxy | null = null
  private planet: Planet | null = null
  /** 记忆星球 + 照片卡片的整体容器，用于绕星球中心匀速自转。 */
  private cluster: THREE.Group | null = null

  private cardTextures: PhotoCardTextures | null = null
  private cards: PhotoCard[] = []
  private hitMeshes: THREE.Object3D[] = []
  private photos: PhotoWallItem[] = []

  private layout: PhotoLayoutMode
  private hoveredCard: PhotoCard | null = null
  private selectedId: number | null = null
  private restoreState: CameraRestoreState | null = null

  private readonly activePointers = new Set<number>()
  private pointerDown = { id: -1, x: 0, y: 0, time: 0, multi: false }

  private frameId = 0
  private mounted = false
  private paused = false
  private disposed = false
  private webglAvailable = false

  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(container: HTMLElement, options: PhotoUniverseEngineOptions = {}) {
    this.container = container
    this.options = options
    this.layout = options.layout ?? 'galaxy'
  }

  mount(): void {
    if (this.mounted || this.disposed) {
      return
    }
    this.mounted = true

    this.sceneManager = new SceneManager(this.resources)
    this.rendererManager = new RendererManager({
      container: this.container,
      quality: this.options.quality ?? 'auto',
      onUnavailable: (reason) => {
        this.webglAvailable = false
        this.options.onUnavailable?.(reason)
      },
      onContextLost: () => {
        this.paused = true
        cancelAnimationFrame(this.frameId)
        this.frameId = 0
        this.options.onContextLost?.()
      },
      onContextRestored: () => {
        this.paused = false
        this.clock.start()
        this.animate()
        this.options.onContextRestored?.()
      },
      onResize: (width, height) => this.handleResize(width, height)
    })

    if (!this.rendererManager.isAvailable || !this.rendererManager.renderer) {
      this.webglAvailable = false
      return
    }

    this.webglAvailable = true
    const renderer = this.rendererManager.renderer
    const quality = this.rendererManager.quality
    renderer.domElement.style.touchAction = 'none'

    this.cameraManager = new CameraManager(this.rendererManager.width / this.rendererManager.height)
    const camera = this.cameraManager.camera
    camera.position.copy(INTRO_POSITION)
    camera.lookAt(HOME_TARGET)

    this.controls = new CameraControls(camera, renderer.domElement, {
      enabled: false,
      autoRotate: false,
      minDistance: 6,
      maxDistance: 90
    })
    this.controls.controls.target.copy(HOME_TARGET)

    this.stars = new StarParticles(quality, this.resources)
    this.galaxy = new Galaxy(quality, this.resources)
    this.planet = new Planet(quality, this.resources)

    // 星球与照片挂在同一个容器里，容器绕星球中心整体匀速转动。
    this.cluster = new THREE.Group()
    this.cluster.position.copy(this.planet.position)
    this.planet.group.position.set(0, 0, 0)
    this.cluster.add(this.planet.group)
    this.sceneManager.add(this.galaxy.group, this.stars.group, this.cluster)

    const glow = this.resources.track(createGlowTexture())
    this.cardTextures = {
      loading: this.resources.track(createPlaceholderTexture('loading')),
      error: this.resources.track(createPlaceholderTexture('error')),
      glow
    }

    this.stars.setPixelRatio(renderer.getPixelRatio())

    const canvas = renderer.domElement
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointercancel', this.handlePointerCancel)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.style.cursor = 'grab'

    this.clock.start()
    this.playIntro()
    this.animate()
    this.options.onReady?.()
  }

  get isAvailable(): boolean {
    return this.webglAvailable
  }

  get currentLayout(): PhotoLayoutMode {
    return this.layout
  }

  setPhotos(photos: PhotoWallItem[]): void {
    this.photos = photos
    if (!this.sceneManager || !this.cardTextures) {
      return
    }

    this.clearSelection(false)
    this.cards.forEach((card) => card.dispose())
    this.cards = []
    this.hitMeshes = []
    this.hoveredCard = null

    this.cards = photos.map(
      (item) => new PhotoCard(item, this.textures, this.cardTextures as PhotoCardTextures)
    )
    this.hitMeshes = this.cards.map((card) => card.hitMesh)
    this.cards.forEach((card) => this.cluster?.add(card.group))
    this.applyLayout(false)
  }

  setLayout(layout: PhotoLayoutMode): void {
    if (this.layout === layout) {
      return
    }
    this.clearSelection(false)
    this.layout = layout
    // 时间轴是线性浏览视图，切换过去时把整体旋转复位，避免整排照片歪斜。
    if (layout === 'timeline' && this.cluster) {
      gsap.killTweensOf(this.cluster.rotation)
      gsap.to(this.cluster.rotation, { y: 0, duration: 0.9, ease: 'power2.inOut' })
    }
    this.applyLayout(true)
  }

  /** 供 Vue 详情面板的上一张 / 下一张调用，不重复触发 onSelect。 */
  focusPhoto(id: number): void {
    this.selectPhoto(id, false)
  }

  clearSelection(emit = true): void {
    if (this.selectedId === null) {
      return
    }

    const previous = this.cards.find((card) => card.item.id === this.selectedId)
    previous?.setActive(false)
    this.selectedId = null

    const restore = this.restoreState
    this.restoreState = null
    if (restore) {
      this.tweenCamera(restore.position, restore.target, 1.5)
    } else {
      this.tweenCamera(HOME_POSITION, HOME_TARGET, 1.5)
    }

    if (emit) {
      this.options.onDeselect?.()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    cancelAnimationFrame(this.frameId)
    this.frameId = 0

    const canvas = this.rendererManager?.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('pointermove', this.handlePointerMove)
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('pointerup', this.handlePointerUp)
      canvas.removeEventListener('pointercancel', this.handlePointerCancel)
      canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    }

    if (this.cameraManager) {
      gsap.killTweensOf(this.cameraManager.camera.position)
    }
    if (this.controls) {
      gsap.killTweensOf(this.controls.controls.target)
    }

    this.cards.forEach((card) => card.dispose())
    this.cards = []
    this.hitMeshes = []

    this.sceneManager?.dispose()
    this.sceneManager = null

    this.controls?.dispose()
    this.controls = null
    this.cameraManager?.dispose()
    this.cameraManager = null

    this.stars = null
    this.galaxy = null
    this.planet = null
    this.cluster = null

    this.textures.disposeAll()
    this.resources.disposeAll()

    this.rendererManager?.dispose()
    this.rendererManager = null
    this.cardTextures = null
    this.photos = []
    this.mounted = false
  }

  private applyLayout(animate: boolean): void {
    if (this.cards.length === 0) {
      return
    }
    const placements = computePhotoLayout(this.photos, this.layout)
    // 布局坐标是世界坐标；挂到整体容器后需要换算成以星球中心为原点的局部坐标。
    const origin = this.cluster?.position ?? new THREE.Vector3(0, 0, 0)
    this.cards.forEach((card, index) => {
      const placement = placements[index]
      if (placement) {
        const local = {
          position: [
            placement.position[0] - origin.x,
            placement.position[1] - origin.y,
            placement.position[2] - origin.z
          ] as [number, number, number],
          quaternion: placement.quaternion
        }
        card.setLayout(local, animate, animate ? index * 0.012 : 0)
      }
    })
  }

  private playIntro(): void {
    if (!this.cameraManager || !this.controls) {
      return
    }
    if (this.reduceMotion) {
      this.cameraManager?.camera.position.copy(HOME_POSITION)
      this.controls?.setEnabled(true)
      return
    }
    gsap.to(this.cameraManager.camera.position, {
      x: HOME_POSITION.x,
      y: HOME_POSITION.y,
      z: HOME_POSITION.z,
      duration: 3.4,
      ease: 'power2.inOut',
      onComplete: () => this.controls?.setEnabled(true)
    })
  }

  private selectPhoto(id: number, emit: boolean): void {
    const card = this.cards.find((item) => item.item.id === id)
    if (!card || this.selectedId === id) {
      return
    }

    if (this.selectedId !== null) {
      this.cards.find((item) => item.item.id === this.selectedId)?.setActive(false)
    } else if (this.controls) {
      this.restoreState = {
        position: this.cameraManager?.camera.position.clone() ?? HOME_POSITION.clone(),
        target: this.controls.controls.target.clone()
      }
    }

    this.selectedId = id
    card.setActive(true)
    this.focusCard(card)

    if (emit) {
      this.options.onSelect?.(card.item)
    }
  }

  private focusCard(card: PhotoCard): void {
    if (!this.cameraManager || !this.controls) {
      return
    }
    const camera = this.cameraManager.camera
    const cardPosition = new THREE.Vector3()
    const cardQuaternion = new THREE.Quaternion()
    card.group.getWorldPosition(cardPosition)
    card.group.getWorldQuaternion(cardQuaternion)

    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(cardQuaternion).normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cardQuaternion).normalize()

    const verticalFov = THREE.MathUtils.degToRad(camera.fov)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
    const fitHeight = 2.6 / Math.tan(verticalFov / 2)
    const fitWidth = 3.4 / Math.tan(horizontalFov / 2)
    const distance = Math.max(6.2, fitHeight, fitWidth)

    const viewPosition = cardPosition.clone().addScaledVector(normal, distance)
    if (window.innerWidth >= 900) {
      viewPosition.addScaledVector(right, 2.6)
    } else {
      viewPosition.y -= 1.8
    }

    this.tweenCamera(viewPosition, cardPosition, 1.45)
  }

  private tweenCamera(position: THREE.Vector3, target: THREE.Vector3, duration: number): void {
    const camera = this.cameraManager?.camera
    if (!camera) {
      return
    }

    gsap.killTweensOf(camera.position)
    if (this.controls) {
      gsap.killTweensOf(this.controls.controls.target)
      this.controls.setEnabled(false)
    }

    gsap.to(camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration: this.reduceMotion ? 0.01 : duration,
      ease: 'power2.inOut'
    })

    if (this.controls) {
      gsap.to(this.controls.controls.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: this.reduceMotion ? 0.01 : duration,
        ease: 'power2.inOut',
        onComplete: () => this.controls?.setEnabled(true)
      })
    }
  }

  private setHoveredCard(card: PhotoCard | null): void {
    if (this.hoveredCard === card) {
      return
    }
    this.hoveredCard?.setHovered(false)
    this.hoveredCard = card
    card?.setHovered(true)

    const canvas = this.rendererManager?.renderer?.domElement
    if (canvas) {
      canvas.style.cursor = card ? 'pointer' : 'grab'
    }
  }

  private pickCard(event: PointerEvent): PhotoCard | null {
    const camera = this.cameraManager?.camera
    const renderer = this.rendererManager?.renderer
    if (!camera || !renderer) {
      return null
    }

    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const hits = this.raycaster.intersectObjects(this.hitMeshes, false)
    return (hits[0]?.object.userData.card as PhotoCard | undefined) ?? null
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.paused || this.disposed) {
      return
    }
    if (this.pointerDown.id === event.pointerId) {
      const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y)
      if (distance > 7) {
        this.setHoveredCard(null)
      }
      return
    }
    this.setHoveredCard(this.pickCard(event))
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId)
    if (this.activePointers.size > 1) {
      this.pointerDown.multi = true
      this.setHoveredCard(null)
      return
    }
    if (event.button !== 0) {
      return
    }
    this.pointerDown = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      multi: false
    }
    const canvas = this.rendererManager?.renderer?.domElement
    if (canvas) {
      canvas.style.cursor = 'grabbing'
    }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId)

    if (this.pointerDown.multi) {
      if (this.activePointers.size === 0) {
        this.pointerDown.multi = false
        this.pointerDown.id = -1
      }
      return
    }

    if (event.pointerId !== this.pointerDown.id) {
      return
    }

    const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y)
    const elapsed = performance.now() - this.pointerDown.time
    this.pointerDown.id = -1

    if (distance <= 7 && elapsed <= 700) {
      const card = this.pickCard(event)
      if (card) {
        this.selectPhoto(card.item.id, true)
      } else {
        this.setHoveredCard(null)
        this.clearSelection(true)
      }
    } else {
      this.setHoveredCard(this.pickCard(event))
    }

    const canvas = this.rendererManager?.renderer?.domElement
    if (canvas) {
      canvas.style.cursor = this.hoveredCard ? 'pointer' : 'grab'
    }
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId)
    this.pointerDown.id = -1
    this.pointerDown.multi = false
    this.setHoveredCard(null)
  }

  private readonly handlePointerLeave = (): void => {
    if (this.pointerDown.id === -1) {
      this.setHoveredCard(null)
    }
  }

  private handleResize(width: number, height: number): void {
    this.cameraManager?.resize(width, height)
    if (this.rendererManager?.renderer) {
      this.stars?.setPixelRatio(this.rendererManager.renderer.getPixelRatio())
    }
  }

  private readonly animate = (): void => {
    if (this.disposed) {
      return
    }
    this.frameId = requestAnimationFrame(this.animate)
    if (this.paused) {
      return
    }

    const delta = Math.min(this.clock.getDelta(), 0.05)
    const elapsed = this.clock.elapsedTime

    this.stars?.update(elapsed, delta, 0, 0)
    this.galaxy?.update(delta, 0, 0)
    this.planet?.update(elapsed, delta)

    // 近景照片宇宙：星球连同照片整体匀速自转；聚焦某张照片或时间轴视图时暂停。
    if (
      this.cluster &&
      !this.reduceMotion &&
      this.selectedId === null &&
      this.layout !== 'timeline'
    ) {
      this.cluster.rotation.y += delta * CLUSTER_ROTATION_SPEED
    }

    this.cards.forEach((card) => card.update(elapsed))

    this.controls?.update()

    const renderer = this.rendererManager?.renderer
    const scene = this.sceneManager?.scene
    const camera = this.cameraManager?.camera
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }
}
