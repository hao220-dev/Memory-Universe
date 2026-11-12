import * as THREE from 'three'

export type QualityLevel = 'high' | 'medium' | 'low'

export interface QualityProfile {
  level: QualityLevel
  maxPixelRatio: number
  antialias: boolean
  starCount: number
  galaxyCount: number
  nebulaCount: number
  orbitParticleCount: number
  bloom: boolean
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  bloomResolutionScale: number
}

const PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    level: 'high',
    maxPixelRatio: 2,
    antialias: true,
    starCount: 11000,
    galaxyCount: 14000,
    nebulaCount: 5,
    orbitParticleCount: 620,
    bloom: true,
    bloomStrength: 0.92,
    bloomRadius: 0.72,
    bloomThreshold: 0.52,
    bloomResolutionScale: 1
  },
  medium: {
    level: 'medium',
    maxPixelRatio: 1.6,
    antialias: false,
    starCount: 6200,
    galaxyCount: 7600,
    nebulaCount: 4,
    orbitParticleCount: 380,
    bloom: true,
    bloomStrength: 0.68,
    bloomRadius: 0.6,
    bloomThreshold: 0.62,
    bloomResolutionScale: 0.65
  },
  low: {
    level: 'low',
    maxPixelRatio: 1,
    antialias: false,
    starCount: 3200,
    galaxyCount: 3600,
    nebulaCount: 2,
    orbitParticleCount: 180,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    bloomResolutionScale: 1
  }
}

export function detectQualityLevel(): QualityLevel {
  if (typeof window === 'undefined') {
    return 'medium'
  }
  const cores = navigator.hardwareConcurrency ?? 4
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 768
  const lowMemory =
    (navigator as unknown as { deviceMemory?: number }).deviceMemory !== undefined &&
    ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4

  if (lowMemory || (coarsePointer && cores <= 4) || (narrow && cores <= 4)) {
    return 'low'
  }
  if (coarsePointer || narrow || cores <= 6) {
    return 'medium'
  }
  return 'high'
}

export function resolveQualityProfile(quality: QualityLevel | 'auto' = 'auto'): QualityProfile {
  return PROFILES[quality === 'auto' ? detectQualityLevel() : quality]
}

export interface RendererManagerOptions {
  container: HTMLElement
  quality?: QualityLevel | 'auto'
  onContextLost?: () => void
  onContextRestored?: () => void
  onUnavailable?: (reason: string) => void
  onResize?: (width: number, height: number) => void
}

/**
 * 渲染器管理：画质分级、DPR 限制、ResizeObserver、WebGL 不可用与上下文丢失处理。
 */
export class RendererManager {
  readonly quality: QualityProfile
  readonly renderer: THREE.WebGLRenderer | null = null
  private readonly container: HTMLElement
  private readonly options: RendererManagerOptions
  private resizeObserver: ResizeObserver | null = null
  private disposed = false

  constructor(options: RendererManagerOptions) {
    this.container = options.container
    this.options = options
    this.quality = resolveQualityProfile(options.quality)

    if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
      options.onUnavailable?.('WebGL is not supported')
      return
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: this.quality.antialias,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false
      })
    } catch (error) {
      options.onUnavailable?.(error instanceof Error ? error.message : 'WebGL init failed')
      return
    }

    const renderer = this.renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio))
    renderer.setSize(this.width, this.height, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.autoClear = true
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    this.container.appendChild(renderer.domElement)

    renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false)
    renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false)

    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed || !this.renderer) {
        return
      }
      this.renderer.setSize(this.width, this.height, false)
      this.options.onResize?.(this.width, this.height)
    })
    this.resizeObserver.observe(this.container)
  }

  get width(): number {
    return Math.max(this.container.clientWidth, 1)
  }

  get height(): number {
    return Math.max(this.container.clientHeight, 1)
  }

  get isAvailable(): boolean {
    return this.renderer !== null
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.options.onContextLost?.()
  }

  private readonly handleContextRestored = (): void => {
    this.options.onContextRestored?.()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    const renderer = this.renderer
    if (!renderer) {
      return
    }

    renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored)
    renderer.dispose()
    renderer.forceContextLoss()
    if (renderer.domElement.parentElement === this.container) {
      this.container.removeChild(renderer.domElement)
    }
  }
}
