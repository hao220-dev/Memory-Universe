import * as THREE from 'three'
import gsap from 'gsap'

export interface CameraFlyOptions {
  position: THREE.Vector3
  target?: THREE.Vector3
  duration?: number
  ease?: string
  delay?: number
}

/**
 * 相机管理：视口适配、GSAP 飞行、视差偏移。
 * 相机基础位置由 GSAP 补间驱动，视差偏移在每帧叠加，互不冲突。
 */
export class CameraManager {
  readonly camera: THREE.PerspectiveCamera
  readonly basePosition = new THREE.Vector3(0, 1.4, 30)
  readonly target = new THREE.Vector3(0, 0, -18)
  private readonly parallaxOffset = new THREE.Vector3()
  private tween: gsap.core.Tween | null = null
  private disposed = false

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 2400)
    this.camera.position.copy(this.basePosition)
    this.camera.lookAt(this.target)
  }

  setBasePosition(x: number, y: number, z: number): void {
    this.basePosition.set(x, y, z)
    this.sync()
  }

  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z)
    this.camera.lookAt(this.target)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1)
    this.camera.updateProjectionMatrix()
  }

  /**
   * GSAP 相机移动。场景仍由自身 RAF 渲染，GSAP 只补间相机数值。
   */
  flyTo(options: CameraFlyOptions): Promise<void> {
    this.tween?.kill()
    const duration = options.duration ?? 2.4
    const ease = options.ease ?? 'power2.inOut'

    return new Promise((resolve) => {
      this.tween = gsap.to(this.basePosition, {
        x: options.position.x,
        y: options.position.y,
        z: options.position.z,
        duration,
        delay: options.delay ?? 0,
        ease,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.tween = null
          if (options.target) {
            this.target.copy(options.target)
          }
          this.sync()
          resolve()
        }
      })
    })
  }

  applyParallax(x: number, y: number): void {
    this.parallaxOffset.set(x, y, 0)
    this.sync()
  }

  private sync(): void {
    if (this.disposed) {
      return
    }
    this.camera.position.copy(this.basePosition).add(this.parallaxOffset)
    this.camera.lookAt(this.target)
  }

  dispose(): void {
    this.disposed = true
    this.tween?.kill()
    this.tween = null
  }
}
