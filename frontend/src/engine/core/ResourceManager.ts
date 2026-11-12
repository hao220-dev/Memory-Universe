import * as THREE from 'three'

interface Disposable {
  dispose: () => void
}

type Cleanup = () => void

/**
 * 统一管理 GPU 资源、事件监听与定时器。
 * 场景内所有几何体 / 材质 / 纹理 / RenderTarget 都应在此登记，
 * 组件卸载时一次性释放，避免显存泄漏。
 */
export class ResourceManager {
  private readonly disposables = new Set<Disposable>()
  private readonly cleanups = new Set<Cleanup>()
  private disposed = false

  get isDisposed(): boolean {
    return this.disposed
  }

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      resource.dispose()
      return resource
    }
    this.disposables.add(resource)
    return resource
  }

  addCleanup(cleanup: Cleanup): void {
    if (this.disposed) {
      cleanup()
      return
    }
    this.cleanups.add(cleanup)
  }

  release(resource: Disposable): void {
    if (this.disposables.delete(resource)) {
      resource.dispose()
    }
  }

  /**
   * 遍历对象树，登记几何体、材质及其引用的纹理。
   * 支持 Mesh / Points / Line / Sprite。
   */
  trackObject(root: THREE.Object3D): void {
    root.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite
      if (renderable.geometry) {
        this.track(renderable.geometry)
      }

      const material = renderable.material
      if (!material) {
        return
      }

      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((item) => {
        this.track(item)
        Object.values(item as unknown as Record<string, unknown>).forEach((value) => {
          if (value instanceof THREE.Texture) {
            this.track(value)
          }
        })
      })
    })
  }

  disposeAll(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    this.cleanups.forEach((cleanup) => {
      try {
        cleanup()
      } catch {
        // 单个清理失败不应阻断其余资源释放
      }
    })
    this.cleanups.clear()

    this.disposables.forEach((resource) => {
      try {
        resource.dispose()
      } catch {
        // 忽略重复 dispose
      }
    })
    this.disposables.clear()
  }
}
