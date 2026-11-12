import * as THREE from 'three'
import type { ResourceManager } from '../core/ResourceManager'
import type { QualityProfile } from '../core/RendererManager'

function createNebulaTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    gradient.addColorStop(0.26, 'rgba(255, 255, 255, 0.42)')
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.12)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * 星系系统：螺旋星轨粒子 + 深空星云 + 星系核心。
 * 使用 BufferGeometry 承载万余粒子，蓝紫色渐变构建空间纵深。
 */
export class Galaxy {
  readonly group = new THREE.Group()
  private readonly baseX = 0
  private readonly baseY = 34
  private readonly spiral: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>

  constructor(profile: QualityProfile, resources: ResourceManager) {
    const texture = createNebulaTexture()
    const coreColor = new THREE.Color()

    const positions: number[] = []
    const colors: number[] = []
    const arms = 5
    const count = profile.galaxyCount

    for (let index = 0; index < count; index += 1) {
      const radius = Math.pow(Math.random(), 0.62) * 225 + 5
      const arm = Math.floor(Math.random() * arms)
      const armAngle = (arm / arms) * Math.PI * 2
      const spin = radius * 0.02
      const spread = (Math.random() - 0.5) * (0.34 + radius * 0.0016)
      const angle = armAngle + spin + spread

      const jitter = (Math.random() - 0.5) * (2.4 + radius * 0.02)
      const x = Math.cos(angle) * radius + jitter
      const z = Math.sin(angle) * radius + jitter
      const thickness = (Math.random() - 0.5) * (5 + radius * 0.055)

      positions.push(x, thickness, z)

      const ratio = radius / 230
      const violet = Math.random() < 0.26
      if (violet) {
        coreColor.setHSL(0.73 + Math.random() * 0.05, 0.78, 0.6 - ratio * 0.12)
      } else {
        coreColor.setHSL(0.55 + Math.random() * 0.05, 0.6, 0.78 - ratio * 0.26)
      }
      colors.push(coreColor.r, coreColor.g, coreColor.b)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 1.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    })

    this.spiral = new THREE.Points(geometry, material)
    this.spiral.frustumCulled = false
    this.spiral.renderOrder = -3
    this.group.add(this.spiral)

    // 星系核心光晕
    const coreMaterial = new THREE.SpriteMaterial({
      map: texture,
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const core = new THREE.Sprite(coreMaterial)
    core.scale.set(90, 90, 1)
    this.group.add(core)

    // 深空星云
    const nebulaColors = [0x38bdf8, 0x7c3aed, 0x6366f1, 0x0ea5e9, 0xc084fc]
    const nebulaCount = profile.nebulaCount
    for (let index = 0; index < nebulaCount; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: nebulaColors[index % nebulaColors.length],
        transparent: true,
        opacity: 0.09 + Math.random() * 0.05,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const sprite = new THREE.Sprite(material)
      const angle = (index / nebulaCount) * Math.PI * 2 + 0.8
      sprite.position.set(
        Math.cos(angle) * (170 + index * 30),
        Math.sin(angle * 1.3) * 90 + 20,
        Math.sin(angle) * (120 + index * 24)
      )
      const scale = 240 + index * 46
      sprite.scale.set(scale, scale * 0.72, 1)
      sprite.renderOrder = -4
      this.group.add(sprite)
    }

    this.group.position.set(this.baseX, this.baseY, -520)
    this.group.rotation.set(-1.05, 0.1, 0.42)
    resources.trackObject(this.group)
  }

  update(delta: number, parallaxX: number, parallaxY: number): void {
    this.group.rotation.z += delta * 0.008
    this.spiral.rotation.y += delta * 0.004
    this.group.position.x = this.baseX - parallaxX * 9
    this.group.position.y = this.baseY + parallaxY * 6
  }
}
