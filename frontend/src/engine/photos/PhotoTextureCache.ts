import * as THREE from 'three'

export type TextureQuality = 'thumb' | 'full'

export interface PhotoTextureEntry {
  readonly key: string
  readonly url: string
  readonly quality: TextureQuality
  texture: THREE.Texture | null
  status: 'loading' | 'ready' | 'error'
  promise: Promise<THREE.Texture>
  refs: number
  lastUsed: number
}

const FULL_TEXTURE_LIMIT = 6

/**
 * 照片纹理缓存：同一 URL 只发起一次请求，按引用计数释放。
 * 缩略图常驻；高清纹理使用 LRU 限制，避免浏览大量照片时显存膨胀。
 */
export class PhotoTextureCache {
  private readonly entries = new Map<string, PhotoTextureEntry>()
  private readonly loader = new THREE.TextureLoader()
  private disposed = false
  private tick = 0

  constructor() {
    this.loader.setCrossOrigin('anonymous')
  }

  acquire(url: string, quality: TextureQuality = 'thumb'): PhotoTextureEntry {
    const key = `${quality}:${url}`
    const existing = this.entries.get(key)
    if (existing) {
      existing.refs += 1
      existing.lastUsed = ++this.tick
      return existing
    }

    let resolveTexture: (texture: THREE.Texture) => void = () => undefined
    let rejectTexture: (reason: unknown) => void = () => undefined
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      resolveTexture = resolve
      rejectTexture = reject
    })

    const entry: PhotoTextureEntry = {
      key,
      url,
      quality,
      texture: null,
      status: 'loading',
      promise,
      refs: 1,
      lastUsed: ++this.tick
    }
    this.entries.set(key, entry)

    this.loader.load(
      url,
      (texture) => {
        if (this.disposed) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        entry.texture = texture
        entry.status = 'ready'
        this.evictFullTextures()
        resolveTexture(texture)
      },
      undefined,
      (error) => {
        if (this.disposed) {
          return
        }
        entry.status = 'error'
        rejectTexture(error)
      }
    )

    return entry
  }

  release(url: string, quality: TextureQuality = 'thumb'): void {
    const key = `${quality}:${url}`
    const entry = this.entries.get(key)
    if (!entry) {
      return
    }
    entry.refs = Math.max(0, entry.refs - 1)
    entry.lastUsed = ++this.tick
    this.evictFullTextures()
  }

  private evictFullTextures(): void {
    if (this.disposed) {
      return
    }
    const fullEntries = Array.from(this.entries.values()).filter(
      (entry) => entry.quality === 'full' && entry.texture
    )
    if (fullEntries.length <= FULL_TEXTURE_LIMIT) {
      return
    }

    const idle = fullEntries
      .filter((entry) => entry.refs === 0)
      .sort((a, b) => a.lastUsed - b.lastUsed)

    while (fullEntries.length > FULL_TEXTURE_LIMIT && idle.length > 0) {
      const entry = idle.shift()
      if (!entry) {
        break
      }
      entry.texture?.dispose()
      this.entries.delete(entry.key)
      fullEntries.splice(fullEntries.indexOf(entry), 1)
    }
  }

  disposeAll(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.entries.forEach((entry) => {
      entry.texture?.dispose()
      entry.texture = null
    })
    this.entries.clear()
  }
}
