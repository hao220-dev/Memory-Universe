import * as THREE from 'three'
import gsap from 'gsap'
import type { PhotoTextureCache, PhotoTextureEntry } from './PhotoTextureCache'
import type { PhotoPlacement, PhotoWallItem } from './types'

const CARD_WIDTH = 4.8
const CARD_HEIGHT = 3.25
const CARD_PADDING = 0.24
const INNER_WIDTH = CARD_WIDTH - CARD_PADDING * 2
const INNER_HEIGHT = CARD_HEIGHT - CARD_PADDING * 2

const frameVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frameFragment = /* glsl */ `
  uniform float uEmphasis;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  void main() {
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float border = 1.0 - smoothstep(0.0, 0.05, edge);
    float inner = smoothstep(0.0, 0.1, edge);
    float sweep = smoothstep(0.72, 1.0, sin((vUv.x + vUv.y) * 7.0 - uTime * 0.9) * 0.5 + 0.5);

    vec3 color = mix(uColorA, uColorB, vUv.x * 0.65 + vUv.y * 0.35);
    float alpha = border * (0.5 + uEmphasis * 0.55) + inner * 0.05 + sweep * border * uEmphasis * 0.4;
    color += vec3(0.16, 0.5, 0.9) * sweep * uEmphasis * 0.6;

    gl_FragColor = vec4(color, alpha);
  }
`

export interface PhotoCardTextures {
  loading: THREE.Texture
  error: THREE.Texture
  glow: THREE.Texture
}

/**
 * 单张 3D 照片卡片：背板 + 发光描边 + 缩略图 / 高清图 + 光晕 + 拾取面。
 * 位置与朝向由外部布局驱动，漂浮与放大动画只作用于内部 body。
 */
export class PhotoCard {
  readonly group = new THREE.Group()
  readonly body = new THREE.Group()
  readonly item: PhotoWallItem
  readonly hitMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

  private readonly cache: PhotoTextureCache
  private readonly textures: PhotoCardTextures
  private readonly imageMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private readonly frameMaterial: THREE.ShaderMaterial
  private readonly backingGeometry: THREE.PlaneGeometry
  private readonly backingMaterial: THREE.MeshBasicMaterial
  private readonly frameGeometry: THREE.PlaneGeometry
  private readonly imageGeometry: THREE.PlaneGeometry
  private readonly glowMaterial: THREE.SpriteMaterial

  private readonly phase: number
  private readonly emphasis = { value: 0 }
  private emphasisTween: gsap.core.Tween | null = null
  private layoutTween: gsap.core.Tween | null = null

  private thumbEntry: PhotoTextureEntry | null = null
  private fullEntry: PhotoTextureEntry | null = null
  private hovered = false
  private active = false
  private disposed = false

  constructor(
    item: PhotoWallItem,
    cache: PhotoTextureCache,
    textures: PhotoCardTextures
  ) {
    this.item = item
    this.cache = cache
    this.textures = textures
    this.phase = (Math.abs(item.id) % 89) / 89

    this.backingGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT)
    this.backingMaterial = new THREE.MeshBasicMaterial({
      color: 0x060b1e,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    })

    this.frameGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT)
    this.frameMaterial = new THREE.ShaderMaterial({
      vertexShader: frameVertex,
      fragmentShader: frameFragment,
      uniforms: {
        uEmphasis: { value: 0 },
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x38bdf8) },
        uColorB: { value: new THREE.Color(0xa855f7) }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    this.imageGeometry = new THREE.PlaneGeometry(1, 1)
    this.imageMesh = new THREE.Mesh(
      this.imageGeometry,
      new THREE.MeshBasicMaterial({
        map: textures.loading,
        toneMapped: false,
        side: THREE.FrontSide
      })
    )
    this.imageMesh.scale.set(INNER_WIDTH, INNER_WIDTH * 0.75, 1)

    this.glowMaterial = new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const glow = new THREE.Sprite(this.glowMaterial)
    glow.scale.set(11, 8, 1)
    glow.position.z = -0.25

    this.hitMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false
      })
    )
    this.hitMesh.position.z = 0.04
    this.hitMesh.userData.card = this

    const backing = new THREE.Mesh(this.backingGeometry, this.backingMaterial)
    backing.position.z = -0.05
    const frame = new THREE.Mesh(this.frameGeometry, this.frameMaterial)
    frame.position.z = -0.02

    this.body.add(glow, backing, frame, this.imageMesh, this.hitMesh)
    this.group.add(this.body)

    this.thumbEntry = this.cache.acquire(item.thumbnailUrl, 'thumb')
    this.thumbEntry.promise
      .then((texture) => {
        if (this.disposed || this.fullEntry?.texture) {
          return
        }
        this.applyTexture(texture)
      })
      .catch(() => {
        if (!this.disposed) {
          this.applyTexture(this.textures.error)
          this.fitAspect(4 / 3)
        }
      })
  }

  setLayout(placement: PhotoPlacement, animate: boolean, delay = 0): void {
    if (this.disposed) {
      return
    }
    const position = new THREE.Vector3(...placement.position)
    const quaternion = new THREE.Quaternion(...placement.quaternion)

    this.layoutTween?.kill()
    this.layoutTween = null

    if (!animate) {
      this.group.position.copy(position)
      this.group.quaternion.copy(quaternion)
      return
    }

    const fromPosition = this.group.position.clone()
    const fromQuaternion = this.group.quaternion.clone()
    const proxy = { t: 0 }
    this.layoutTween = gsap.to(proxy, {
      t: 1,
      duration: 1.5,
      delay,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.group.position.lerpVectors(fromPosition, position, proxy.t)
        this.group.quaternion.slerpQuaternions(fromQuaternion, quaternion, proxy.t)
      }
    })
  }

  setHovered(hovered: boolean): void {
    if (this.hovered === hovered || this.disposed) {
      return
    }
    this.hovered = hovered
    this.refreshEmphasis(false)
  }

  setActive(active: boolean): void {
    if (this.active === active || this.disposed) {
      return
    }
    this.active = active
    if (active) {
      this.loadFullTexture()
    } else {
      this.releaseFullTexture()
    }
    this.refreshEmphasis(false)
  }

  update(elapsed: number): void {
    if (this.disposed) {
      return
    }
    const speed = 0.5 + this.phase * 0.42
    const phase = this.phase * Math.PI * 2

    this.body.position.x = Math.sin(elapsed * speed + phase) * 0.12
    this.body.position.y = Math.cos(elapsed * speed * 0.82 + phase) * 0.22
    this.body.rotation.z = Math.sin(elapsed * 0.42 + phase) * 0.026
    this.body.rotation.x = Math.cos(elapsed * 0.36 + phase) * 0.018
    this.frameMaterial.uniforms.uTime.value = elapsed
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    this.emphasisTween?.kill()
    this.layoutTween?.kill()

    if (this.thumbEntry) {
      this.cache.release(this.thumbEntry.url, 'thumb')
      this.thumbEntry = null
    }
    if (this.fullEntry) {
      this.cache.release(this.fullEntry.url, 'full')
      this.fullEntry = null
    }

    this.group.removeFromParent()
    this.body.clear()

    this.backingGeometry.dispose()
    this.backingMaterial.dispose()
    this.frameGeometry.dispose()
    this.frameMaterial.dispose()
    this.imageGeometry.dispose()
    this.imageMesh.material.dispose()
    this.hitMesh.geometry.dispose()
    this.hitMesh.material.dispose()
    this.glowMaterial.dispose()
  }

  private refreshEmphasis(immediate: boolean): void {
    const target = this.active ? 1 : this.hovered ? 0.62 : 0
    this.emphasisTween?.kill()

    if (immediate) {
      this.emphasis.value = target
      this.applyEmphasis()
      return
    }

    this.emphasisTween = gsap.to(this.emphasis, {
      value: target,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => this.applyEmphasis()
    })
  }

  private applyEmphasis(): void {
    const value = this.emphasis.value
    this.body.scale.setScalar(1 + value * 0.19)
    this.body.position.z = value * 0.6
    this.frameMaterial.uniforms.uEmphasis.value = value
    this.glowMaterial.opacity = value * 0.62
  }

  private loadFullTexture(): void {
    if (this.fullEntry || this.disposed) {
      return
    }
    if (!this.item.originalUrl || this.item.originalUrl === this.item.thumbnailUrl) {
      return
    }

    const entry = this.cache.acquire(this.item.originalUrl, 'full')
    this.fullEntry = entry
    entry.promise
      .then((texture) => {
        if (this.disposed || this.fullEntry !== entry) {
          return
        }
        this.applyTexture(texture)
      })
      .catch(() => {
        // 高清图失败时保留缩略图，不阻断交互
      })
  }

  private releaseFullTexture(): void {
    if (!this.fullEntry) {
      return
    }
    const entry = this.fullEntry
    this.fullEntry = null
    this.cache.release(entry.url, 'full')

    if (this.thumbEntry?.texture) {
      this.applyTexture(this.thumbEntry.texture)
    } else {
      this.applyTexture(this.textures.loading)
      this.fitAspect(4 / 3)
    }
  }

  private applyTexture(texture: THREE.Texture): void {
    this.imageMesh.material.map = texture
    this.imageMesh.material.needsUpdate = true

    const image = texture.image as
      | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
      | undefined
    const width = image?.naturalWidth ?? image?.width ?? 0
    const height = image?.naturalHeight ?? image?.height ?? 0
    if (width > 0 && height > 0) {
      this.fitAspect(width / height)
    }
  }

  private fitAspect(aspect: number): void {
    let width = INNER_WIDTH
    let height = width / aspect
    if (height > INNER_HEIGHT) {
      height = INNER_HEIGHT
      width = height * aspect
    }
    this.imageMesh.scale.set(width, height, 1)
  }
}
