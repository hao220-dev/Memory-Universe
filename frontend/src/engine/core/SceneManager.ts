import * as THREE from 'three'
import type { ResourceManager } from './ResourceManager'

/**
 * 场景生命周期管理：统一背景、雾效与对象挂载。
 */
export class SceneManager {
  readonly scene: THREE.Scene
  private readonly resources: ResourceManager

  constructor(resources: ResourceManager) {
    this.resources = resources
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050816)
  }

  add(...objects: THREE.Object3D[]): void {
    objects.forEach((object) => this.scene.add(object))
  }

  remove(object: THREE.Object3D): void {
    this.scene.remove(object)
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite
      if (renderable.geometry) {
        this.resources.release(renderable.geometry)
      }
      const material = renderable.material
      if (material) {
        const materials = Array.isArray(material) ? material : [material]
        materials.forEach((item) => this.resources.release(item))
      }
    })
    this.scene.clear()
  }
}
