import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface UniversePhoto {
  id: number
  title: string
  thumbnailUrl: string
  originalUrl: string
  categoryName?: string | null
  takenAt?: string | null
  location?: string | null
  description?: string | null
}

export interface UniverseEngineOptions {
  interactive?: boolean
  cinematic?: boolean
  onSelect?: (photo: UniversePhoto) => void
}

interface PhotoNode {
  group: THREE.Group
  mesh: THREE.Mesh
  frame: THREE.Mesh
  glow: THREE.Sprite
  material: THREE.MeshBasicMaterial
  frameMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.SpriteMaterial
  texture: THREE.Texture | null
  photo: UniversePhoto
  appearedAt: number
  baseY: number
  phase: number
  disposed: boolean
}

const PORTAL_Z = -18
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export class UniverseEngine {
  private readonly container: HTMLElement
  private readonly interactive: boolean
  private readonly cinematic: boolean
  private readonly portalBaseScale: number
  private readonly onSelect?: (photo: UniversePhoto) => void

  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private controls: OrbitControls | null = null

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly clock = new THREE.Clock()
  private frameId = 0
  private disposed = false
  private mounted = false

  private photos: UniversePhoto[] = []
  private photoGroup: THREE.Group | null = null
  private photoNodes: PhotoNode[] = []
  private hovered: PhotoNode | null = null

  private starField: THREE.Points | null = null
  private nebulaGroup: THREE.Group | null = null
  private portal: THREE.Group | null = null
  private portalHalo: THREE.Mesh | null = null
  private portalGlass: THREE.Mesh | null = null
  private portalRings: THREE.Mesh[] = []
  private portalParticles: THREE.Points | null = null

  private photoGeometry: THREE.PlaneGeometry | null = null
  private glowTexture: THREE.Texture | null = null
  private starTexture: THREE.Texture | null = null

  private resizeObserver: ResizeObserver | null = null
  private pointerDown = { x: 0, y: 0, time: 0 }
  private readonly parallaxPointer = { x: 0, y: 0 }
  private readonly parallaxCurrent = { x: 0, y: 0 }
  private introStartAt = -1
  private readonly reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(container: HTMLElement, options: UniverseEngineOptions = {}) {
    this.container = container
    this.interactive = options.interactive ?? true
    this.cinematic = options.cinematic ?? false
    this.portalBaseScale = this.cinematic ? 1.15 : 1
    this.onSelect = options.onSelect
  }

  mount(): void {
    if (this.mounted || this.disposed) {
      return
    }
    this.mounted = true

    const width = this.container.clientWidth || window.innerWidth
    const height = this.container.clientHeight || window.innerHeight

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    this.container.appendChild(renderer.domElement)
    this.renderer = renderer

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050816, 0.0075)
    this.scene = scene

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1600)
    if (this.cinematic) {
      camera.position.set(0, 2.8, 66)
    } else {
      camera.position.set(0, this.interactive ? 4 : 1.5, this.interactive ? 34 : 27)
    }
    camera.lookAt(0, 0, 0)
    this.camera = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.enablePan = false
    controls.rotateSpeed = 0.45
    controls.zoomSpeed = 0.6
    controls.minDistance = 8
    controls.maxDistance = 62
    controls.minPolarAngle = Math.PI * 0.2
    controls.maxPolarAngle = Math.PI * 0.8
    controls.target.set(0, 0, 0)
    controls.autoRotate = !this.interactive && !this.cinematic
    controls.autoRotateSpeed = 0.32
    if (!this.interactive) {
      controls.enableRotate = false
      controls.enableZoom = false
      renderer.domElement.style.pointerEvents = 'none'
    }
    this.controls = controls

    this.glowTexture = this.createGlowTexture()
    this.starTexture = this.createStarTexture()

    this.buildStarField()
    this.buildNebula()
    this.buildPortal()

    this.photoGeometry = new THREE.PlaneGeometry(1, 1)
    this.buildPhotos()

    renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    renderer.domElement.addEventListener('pointerup', this.handlePointerUp)
    renderer.domElement.addEventListener('pointermove', this.handlePointerMove)
    renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)

    if (this.cinematic) {
      window.addEventListener('pointermove', this.handleParallaxMove, { passive: true })
    }

    this.clock.start()
    this.animate()
  }

  setPhotos(photos: UniversePhoto[]): void {
    this.photos = photos
    if (!this.scene) {
      return
    }
    this.buildPhotos()
  }

  resize(): void {
    if (!this.renderer || !this.camera) {
      return
    }
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width <= 0 || height <= 0) {
      return
    }
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true

    cancelAnimationFrame(this.frameId)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    window.removeEventListener('pointermove', this.handleParallaxMove)

    const canvas = this.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.handlePointerDown)
      canvas.removeEventListener('pointerup', this.handlePointerUp)
      canvas.removeEventListener('pointermove', this.handlePointerMove)
      canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    }

    this.clearPhotos()
    this.disposeSceneResources()

    this.controls?.dispose()
    this.controls = null

    if (this.renderer) {
      this.renderer.forceContextLoss()
      this.renderer.dispose()
      if (canvas?.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
    }

    this.renderer = null
    this.scene = null
    this.camera = null
    this.starField = null
    this.nebulaGroup = null
    this.portal = null
    this.portalHalo = null
    this.portalGlass = null
    this.portalParticles = null
    this.portalRings = []
    this.photoGeometry = null
    this.glowTexture = null
    this.starTexture = null
    this.photos = []
    this.introStartAt = -1
    this.parallaxPointer.x = 0
    this.parallaxPointer.y = 0
    this.parallaxCurrent.x = 0
    this.parallaxCurrent.y = 0
    this.mounted = false
  }

  // ---------------------------------------------------------------------------
  // 场景构建
  // ---------------------------------------------------------------------------

  private buildStarField(): void {
    if (!this.scene) {
      return
    }
    const mobile = this.container.clientWidth < 768
    const count = this.reduceMotion ? 1600 : mobile ? 3600 : 9000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const palette = [
      new THREE.Color(0xf8fafc),
      new THREE.Color(0x7dd3fc),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xc084fc),
      new THREE.Color(0xa855f7)
    ]

    for (let index = 0; index < count; index += 1) {
      const radius = 60 + Math.random() * 360
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi) * 0.72
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)

      const color = palette[Math.floor(Math.random() * palette.length)]
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: mobile ? 1.9 : 1.4,
      map: this.starTexture ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.starField = points
    this.scene.add(points)
  }

  private buildNebula(): void {
    if (!this.scene || !this.glowTexture) {
      return
    }
    const group = new THREE.Group()
    const colors = [0x38bdf8, 0xa855f7, 0x6366f1, 0x0ea5e9, 0xc084fc]
    const count = this.container.clientWidth < 768 ? 3 : 5
    for (let index = 0; index < count; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: colors[index % colors.length],
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const sprite = new THREE.Sprite(material)
      const angle = (index / count) * Math.PI * 2 + 0.6
      sprite.position.set(
        Math.cos(angle) * (42 + index * 8),
        Math.sin(angle * 1.4) * 26,
        -70 - index * 26
      )
      const scale = 92 + index * 26
      sprite.scale.set(scale * 1.5, scale, 1)
      group.add(sprite)
    }
    this.nebulaGroup = group
    this.scene.add(group)
  }

  private buildPortal(): void {
    if (!this.scene || !this.glowTexture) {
      return
    }
    const group = new THREE.Group()
    group.position.set(0, 0, PORTAL_Z)
    group.rotation.x = 0.1
    group.scale.setScalar(this.portalBaseScale * (this.cinematic ? 0.8 : 1))

    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        color: 0x7c3aed,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    )
    group.add(halo)
    this.portalHalo = halo

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(13.5, 13.5),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    )
    glass.position.z = 0.6
    group.add(glass)
    this.portalGlass = glass

    const ringColors = [0x38bdf8, 0xa855f7, 0x7dd3fc, 0xc084fc]
    for (let index = 0; index < 4; index += 1) {
      const radius = 6.2 + index * 1.25
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.05 + index * 0.012, 8, 150),
        new THREE.MeshBasicMaterial({
          color: ringColors[index],
          transparent: true,
          opacity: 0.58 - index * 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false
        })
      )
      ring.rotation.z = index * 0.55
      ring.rotation.x = index * 0.16
      group.add(ring)
      this.portalRings.push(ring)
    }

    const particleCount = this.container.clientWidth < 768 ? 220 : 520
    const positions = new Float32Array(particleCount * 3)
    for (let index = 0; index < particleCount; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 6.4 + Math.random() * 5.6
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      positions[index * 3 + 2] = (Math.random() - 0.5) * 1.6
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: 0.09,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      })
    )
    group.add(particles)
    this.portalParticles = particles

    this.portal = group
    this.scene.add(group)
  }

  private buildPhotos(): void {
    if (!this.scene) {
      return
    }
    this.clearPhotos()

    const group = new THREE.Group()
    this.scene.add(group)
    this.photoGroup = group

    const mobile = this.container.clientWidth < 768
    const total = this.photos.length
    const densityScale = total > 42 ? 0.78 : total > 24 ? 0.9 : 1

    this.photos.forEach((photo, index) => {
      const node = this.createPhotoNode(photo, index, total, mobile, densityScale)
      group.add(node.group)
      this.photoNodes.push(node)
    })
  }

  private createPhotoNode(
    photo: UniversePhoto,
    index: number,
    total: number,
    mobile: boolean,
    densityScale: number
  ): PhotoNode {
    if (!this.photoGeometry || !this.glowTexture) {
      throw new Error('UniverseEngine 尚未完成初始化')
    }

    const angle = index * GOLDEN_ANGLE + Math.PI * 0.18
    const ring = index % 3
    const baseRadius = mobile ? 9.5 : 12.6
    const radius = baseRadius + ring * (mobile ? 2.3 : 3.4)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = Math.sin(index * 0.85) * (mobile ? 2 : 3.3) + (ring - 1) * 1.1

    const group = new THREE.Group()
    group.position.set(x, y, z)

    const glowMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: index % 2 === 0 ? 0x38bdf8 : 0xa855f7,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const glow = new THREE.Sprite(glowMaterial)
    glow.scale.set(7, 5.4, 1)
    group.add(glow)

    const frameMaterial = new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? 0x38bdf8 : 0xa855f7,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    const frame = new THREE.Mesh(this.photoGeometry, frameMaterial)
    frame.scale.set(3.66, 2.46, 1)
    frame.position.z = -0.04
    group.add(frame)

    const material = new THREE.MeshBasicMaterial({
      color: 0x101b38,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      toneMapped: false
    })
    const mesh = new THREE.Mesh(this.photoGeometry, material)
    mesh.scale.set(3.5 * densityScale, 2.3 * densityScale, 1)
    mesh.userData.photoId = photo.id
    group.add(mesh)

    const node: PhotoNode = {
      group,
      mesh,
      frame,
      glow,
      material,
      frameMaterial,
      glowMaterial,
      texture: null,
      photo,
      appearedAt: this.clock.elapsedTime + index * 0.055,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
      disposed: false
    }

    if (photo.thumbnailUrl) {
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')
      loader.load(
        photo.thumbnailUrl,
        (texture) => {
          if (node.disposed || this.disposed) {
            texture.dispose()
            return
          }
          texture.colorSpace = THREE.SRGBColorSpace
          texture.minFilter = THREE.LinearFilter
          texture.anisotropy = Math.min(8, this.renderer?.capabilities.getMaxAnisotropy() ?? 1)
          node.texture = texture
          material.map = texture
          material.color.set(0xffffff)
          material.needsUpdate = true
          this.fitPlaneToTexture(node, texture, densityScale)
        },
        undefined,
        () => {
          material.color.set(0x111c3a)
        }
      )
    }

    group.scale.setScalar(0.001)
    return node
  }

  private fitPlaneToTexture(node: PhotoNode, texture: THREE.Texture, densityScale: number): void {
    const image = texture.image as { width?: number; height?: number } | undefined
    if (!image?.width || !image?.height) {
      return
    }
    const aspect = image.width / image.height
    const baseWidth = 3.5 * densityScale
    const maxHeight = 2.6 * densityScale
    let width = baseWidth
    let height = width / aspect
    if (height > maxHeight) {
      height = maxHeight
      width = height * aspect
    }
    node.mesh.scale.set(width, height, 1)
    node.frame.scale.set(width + 0.16, height + 0.16, 1)
    node.glow.scale.set(width * 2.05, height * 2.35, 1)
  }

  private clearPhotos(): void {
    this.photoNodes.forEach((node) => {
      node.disposed = true
      node.texture?.dispose()
      node.material.dispose()
      node.frameMaterial.dispose()
      node.glowMaterial.dispose()
      node.group.removeFromParent()
    })
    this.photoNodes = []
    this.hovered = null
    if (this.photoGroup) {
      this.photoGroup.removeFromParent()
      this.photoGroup = null
    }
  }

  // ---------------------------------------------------------------------------
  // 交互
  // ---------------------------------------------------------------------------

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.interactive || !this.camera) {
      return
    }
    const distance = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y)
    const elapsed = performance.now() - this.pointerDown.time
    if (distance > 8 || elapsed > 700) {
      return
    }
    const hit = this.pickPhoto(event)
    if (hit) {
      this.onSelect?.(hit.photo)
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.interactive || !this.camera || !this.renderer) {
      return
    }
    const hit = this.pickPhoto(event)
    this.hovered = hit
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
  }

  private readonly handlePointerLeave = (): void => {
    this.hovered = null
    if (this.renderer) {
      this.renderer.domElement.style.cursor = 'grab'
    }
  }

  private pickPhoto(event: PointerEvent): PhotoNode | null {
    if (!this.camera || this.photoNodes.length === 0) {
      return null
    }
    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const meshes = this.photoNodes.map((node) => node.mesh)
    const intersects = this.raycaster.intersectObjects(meshes, false)
    if (intersects.length === 0) {
      return null
    }
    return this.photoNodes.find((node) => node.mesh === intersects[0].object) ?? null
  }

  private readonly handleParallaxMove = (event: PointerEvent): void => {
    if (this.reduceMotion) {
      return
    }
    this.parallaxPointer.x = (event.clientX / window.innerWidth) * 2 - 1
    this.parallaxPointer.y = (event.clientY / window.innerHeight) * 2 - 1
  }

  private updateCinematic(elapsed: number): void {
    if (this.introStartAt < 0) {
      this.introStartAt = elapsed
    }

    const progress = this.reduceMotion
      ? 1
      : Math.min(1, Math.max(0, (elapsed - this.introStartAt) / 4.2))
    const eased = 1 - Math.pow(1 - progress, 3)

    const smooth = this.reduceMotion ? 1 : 0.045
    this.parallaxCurrent.x += (this.parallaxPointer.x - this.parallaxCurrent.x) * smooth
    this.parallaxCurrent.y += (this.parallaxPointer.y - this.parallaxCurrent.y) * smooth

    if (this.camera) {
      this.camera.position.z = 66 + (30 - 66) * eased
      this.camera.position.x = this.parallaxCurrent.x * 1.6
      this.camera.position.y =
        2.8 + (1.4 - 2.8) * eased - this.parallaxCurrent.y * 1.1
      this.camera.lookAt(0, 0, 0)
    }

    if (this.portal) {
      this.portal.scale.setScalar(this.portalBaseScale * (0.8 + 0.2 * eased))
    }
  }

  // ---------------------------------------------------------------------------
  // 渲染循环
  // ---------------------------------------------------------------------------

  private readonly animate = (): void => {
    if (this.disposed || !this.renderer || !this.scene || !this.camera) {
      return
    }
    this.frameId = requestAnimationFrame(this.animate)

    const delta = Math.min(this.clock.getDelta(), 0.05)
    const elapsed = this.clock.elapsedTime

    if (this.cinematic) {
      this.updateCinematic(elapsed)
    } else {
      this.controls?.update()
    }

    if (this.starField) {
      this.starField.rotation.y += delta * 0.006
      this.starField.rotation.x =
        Math.sin(elapsed * 0.02) * 0.05 + this.parallaxCurrent.y * 0.05
      this.starField.position.x = -this.parallaxCurrent.x * 2.4
      this.starField.position.y = this.parallaxCurrent.y * 1.6
    }

    if (this.nebulaGroup) {
      this.nebulaGroup.position.x = -this.parallaxCurrent.x * 7
      this.nebulaGroup.position.y = this.parallaxCurrent.y * 4.5
    }

    if (this.portal) {
      this.portal.rotation.y = Math.sin(elapsed * 0.16) * 0.12
    }
    this.portalRings.forEach((ring, index) => {
      ring.rotation.z += delta * (0.12 + index * 0.055)
    })
    if (this.portalHalo) {
      const haloMaterial = this.portalHalo.material as THREE.MeshBasicMaterial
      haloMaterial.opacity = 0.3 + Math.sin(elapsed * 0.7) * 0.08
    }
    if (this.portalGlass) {
      const pulse = 1 + Math.sin(elapsed * 0.8) * 0.05
      this.portalGlass.scale.setScalar(pulse)
      const glassMaterial = this.portalGlass.material as THREE.MeshBasicMaterial
      glassMaterial.opacity = 0.6 + Math.sin(elapsed * 0.8) * 0.12
    }
    if (this.portalParticles) {
      this.portalParticles.rotation.z -= delta * 0.06
    }

    this.photoNodes.forEach((node) => {
      const progress = this.reduceMotion
        ? 1
        : Math.min(1, Math.max(0, (elapsed - node.appearedAt) / 0.9))
      const eased = 1 - Math.pow(1 - progress, 3)
      const hoverScale = node === this.hovered ? 1.075 : 1
      const target = eased * hoverScale
      const current = node.group.scale.x
      const next = current + (target - current) * 0.16
      node.group.scale.setScalar(Math.max(next, 0.001))
      node.group.position.y = node.baseY + Math.sin(elapsed * 0.55 + node.phase) * 0.2
      node.group.lookAt(this.camera!.position)
    })

    this.renderer.render(this.scene, this.camera)
  }

  // ---------------------------------------------------------------------------
  // 纹理与资源释放
  // ---------------------------------------------------------------------------

  private createGlowTexture(): THREE.Texture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      )
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.55)')
      gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.12)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  private createStarTexture(): THREE.Texture {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      )
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  private disposeSceneResources(): void {
    if (!this.scene) {
      return
    }
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()

    this.scene.traverse((object) => {
      const geometry = (object as THREE.Mesh).geometry
      if (geometry) {
        geometries.add(geometry)
      }
      const material = (object as unknown as { material?: THREE.Material | THREE.Material[] }).material
      if (Array.isArray(material)) {
        material.forEach((item) => materials.add(item))
      } else if (material) {
        materials.add(material)
      }
    })

    materials.forEach((material) => {
      const record = material as unknown as Record<string, unknown>
      for (const key of ['map', 'alphaMap', 'emissiveMap', 'normalMap']) {
        const value = record[key]
        if (value instanceof THREE.Texture) {
          textures.add(value)
        }
      }
    })

    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    textures.forEach((texture) => texture.dispose())
  }
}
