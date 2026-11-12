import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface CameraControlsOptions {
  enabled?: boolean
  autoRotate?: boolean
  minDistance?: number
  maxDistance?: number
}

/**
 * 相机交互控制：OrbitControls 封装，统一阻尼、缩放范围与启停。
 */
export class CameraControls {
  readonly controls: OrbitControls
  private disposed = false

  constructor(
    camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    options: CameraControlsOptions = {}
  ) {
    this.controls = new OrbitControls(camera, element)
    this.controls.target.set(0, 0, -18)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.enablePan = false
    this.controls.minDistance = options.minDistance ?? 18
    this.controls.maxDistance = options.maxDistance ?? 90
    this.controls.minPolarAngle = Math.PI * 0.2
    this.controls.maxPolarAngle = Math.PI * 0.8
    this.controls.rotateSpeed = 0.55
    this.controls.zoomSpeed = 0.7
    this.controls.autoRotate = options.autoRotate ?? false
    this.controls.autoRotateSpeed = 0.28
    this.controls.enabled = options.enabled ?? true
    this.controls.update()
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  setAutoRotate(autoRotate: boolean): void {
    this.controls.autoRotate = autoRotate
  }

  setTarget(x: number, y: number, z: number): void {
    this.controls.target.set(x, y, z)
  }

  update(): void {
    if (!this.disposed && this.controls.enabled) {
      this.controls.update()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.controls.dispose()
  }
}
