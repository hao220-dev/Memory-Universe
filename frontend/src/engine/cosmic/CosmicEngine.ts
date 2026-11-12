import * as THREE from 'three'
import gsap from 'gsap'
import { ResourceManager } from '../core/ResourceManager'
import { SceneManager } from '../core/SceneManager'
import { CameraManager } from '../core/CameraManager'
import { RendererManager, type QualityLevel } from '../core/RendererManager'
import { CameraControls } from '../core/CameraControls'
import { PostProcessing } from '../core/PostProcessing'
import { StarParticles } from '../systems/StarParticles'
import { Galaxy } from '../systems/Galaxy'
import { Planet } from '../systems/Planet'

export interface CosmicEngineOptions {
  quality?: QualityLevel | 'auto'
  interactive?: boolean
  parallax?: boolean
  intro?: boolean
  onReady?: () => void
  onUnavailable?: (reason: string) => void
  onContextLost?: () => void
  onContextRestored?: () => void
}

/**
 * 星际场景编排器：只依赖 DOM 容器与纯数据，不引用 Vue / Pinia / Router。
 * 组合 Scene / Camera / Renderer / Controls / PostProcessing 与三大粒子系统。
 */
export class CosmicEngine {
  private readonly container: HTMLElement
  private readonly options: CosmicEngineOptions
  private readonly resources = new ResourceManager()

  private sceneManager: SceneManager | null = null
  private cameraManager: CameraManager | null = null
  private rendererManager: RendererManager | null = null
  private controls: CameraControls | null = null
  private post: PostProcessing | null = null

  private stars: StarParticles | null = null
  private galaxy: Galaxy | null = null
  private planet: Planet | null = null

  private readonly clock = new THREE.Clock()
  private readonly parallaxTarget = { x: 0, y: 0 }
  private readonly parallaxCurrent = { x: 0, y: 0 }
  private introTweens: gsap.core.Tween[] = []

  private frameId = 0
  private mounted = false
  private disposed = false
  private paused = false
  private webglAvailable = false

  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(container: HTMLElement, options: CosmicEngineOptions = {}) {
    this.container = container
    this.options = options
  }

  get isAvailable(): boolean {
    return this.webglAvailable
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
    const width = this.rendererManager.width
    const height = this.rendererManager.height

    this.cameraManager = new CameraManager(width / height)
    this.cameraManager.setTarget(0, 0, -18)
    this.cameraManager.setBasePosition(0, 3.2, 66)

    this.stars = new StarParticles(quality, this.resources)
    this.galaxy = new Galaxy(quality, this.resources)
    this.planet = new Planet(quality, this.resources)
    this.sceneManager.add(this.galaxy.group, this.stars.group, this.planet.group)

    if (this.options.interactive) {
      this.controls = new CameraControls(this.cameraManager.camera, renderer.domElement, {
        enabled: true,
        autoRotate: false
      })
    }

    if (quality.bloom) {
      this.post = new PostProcessing(
        renderer,
        this.sceneManager.scene,
        this.cameraManager.camera,
        quality,
        this.resources
      )
      this.post.setSize(width, height)
    }

    this.stars.setPixelRatio(renderer.getPixelRatio())

    if (this.options.parallax !== false) {
      window.addEventListener('pointermove', this.handlePointerMove, { passive: true })
    }

    this.clock.start()
    this.playIntro()
    this.animate()
    this.options.onReady?.()
  }

  private playIntro(): void {
    if (!this.cameraManager || !this.planet || this.options.intro === false || this.reduceMotion) {
      return
    }

    if (!this.controls) {
      void this.cameraManager.flyTo({
        position: new THREE.Vector3(0, 1.4, 30),
        duration: 4.2,
        ease: 'power2.inOut'
      })
    }

    this.introTweens.push(
      gsap.fromTo(
        this.planet.group.scale,
        { x: 0.82, y: 0.82, z: 0.82 },
        { x: 1, y: 1, z: 1, duration: 3.6, ease: 'power2.out' }
      )
    )
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.reduceMotion) {
      return
    }
    this.parallaxTarget.x = (event.clientX / window.innerWidth) * 2 - 1
    this.parallaxTarget.y = (event.clientY / window.innerHeight) * 2 - 1
  }

  private handleResize(width: number, height: number): void {
    this.cameraManager?.resize(width, height)
    this.post?.setSize(width, height)
    if (this.rendererManager?.renderer) {
      this.stars?.setPixelRatio(this.rendererManager.renderer.getPixelRatio())
    }
  }

  private renderFrame(): void {
    const renderer = this.rendererManager?.renderer
    const scene = this.sceneManager?.scene
    const camera = this.cameraManager?.camera
    if (!renderer || !scene || !camera) {
      return
    }
    if (this.post) {
      this.post.render()
    } else {
      renderer.render(scene, camera)
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
    const smooth = this.reduceMotion ? 1 : 0.05
    this.parallaxCurrent.x += (this.parallaxTarget.x - this.parallaxCurrent.x) * smooth
    this.parallaxCurrent.y += (this.parallaxTarget.y - this.parallaxCurrent.y) * smooth

    this.stars?.update(elapsed, delta, this.parallaxCurrent.x, this.parallaxCurrent.y)
    this.galaxy?.update(delta, this.parallaxCurrent.x, this.parallaxCurrent.y)
    this.planet?.update(elapsed, delta)

    if (this.controls) {
      this.controls.update()
    } else {
      this.cameraManager?.applyParallax(
        this.parallaxCurrent.x * 1.6,
        this.parallaxCurrent.y * -1.1
      )
    }

    this.renderFrame()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    cancelAnimationFrame(this.frameId)
    this.frameId = 0
    window.removeEventListener('pointermove', this.handlePointerMove)

    this.introTweens.forEach((tween) => tween.kill())
    this.introTweens = []

    this.controls?.dispose()
    this.controls = null
    this.cameraManager?.dispose()
    this.cameraManager = null

    this.sceneManager?.dispose()
    this.sceneManager = null
    this.stars = null
    this.galaxy = null
    this.planet = null
    this.post = null

    this.resources.disposeAll()

    this.rendererManager?.dispose()
    this.rendererManager = null
    this.mounted = false
  }
}
