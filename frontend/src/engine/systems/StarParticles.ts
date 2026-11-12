import * as THREE from 'three'
import type { ResourceManager } from '../core/ResourceManager'
import type { QualityProfile } from '../core/RendererManager'

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.55 + aPhase * 0.9) + aPhase * 6.2831);
    vColor = aColor;
    vTwinkle = twinkle * uOpacity;

    float size = aSize * uPixelRatio * (160.0 / max(-mvPosition.z, 1.0));
    gl_PointSize = clamp(size, 0.6, 7.0 * uPixelRatio);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float distanceToCenter = length(uv);
    float alpha = smoothstep(0.5, 0.02, distanceToCenter);
    alpha = pow(alpha, 1.6) * vTwinkle;
    gl_FragColor = vec4(vColor * (0.8 + vTwinkle * 0.8), alpha);
  }
`

interface StarLayer {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  parallax: number
  speed: number
}

const LAYER_CONFIG = [
  { fraction: 0.46, minRadius: 300, maxRadius: 620, minSize: 0.7, maxSize: 1.5, opacity: 0.55, parallax: 0.28, speed: 0.004 },
  { fraction: 0.34, minRadius: 150, maxRadius: 300, minSize: 1.1, maxSize: 2.2, opacity: 0.75, parallax: 0.6, speed: 0.008 },
  { fraction: 0.2, minRadius: 70, maxRadius: 150, minSize: 1.6, maxSize: 3.0, opacity: 0.95, parallax: 1, speed: 0.014 }
]

/**
 * 多层星空粒子：三层半径不同的 THREE.Points，
 * 自定义 ShaderMaterial 实现大小衰减与独立相位闪烁。
 */
export class StarParticles {
  readonly group = new THREE.Group()
  private readonly layers: StarLayer[] = []

  constructor(profile: QualityProfile, resources: ResourceManager) {
    LAYER_CONFIG.forEach((config) => {
      const count = Math.max(400, Math.round(profile.starCount * config.fraction))
      const layer = this.createLayer(count, config, profile.maxPixelRatio)
      this.layers.push(layer)
      this.group.add(layer.points)
    })
    resources.trackObject(this.group)
  }

  private createLayer(
    count: number,
    config: (typeof LAYER_CONFIG)[number],
    pixelRatio: number
  ): StarLayer {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const color = new THREE.Color()

    for (let index = 0; index < count; index += 1) {
      const radius =
        config.minRadius +
        Math.pow(Math.random(), 0.72) * (config.maxRadius - config.minRadius)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi) * 0.68
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)

      const violet = Math.random() < 0.18
      const hue = violet ? 0.73 + Math.random() * 0.06 : 0.54 + Math.random() * 0.08
      const lightness = 0.72 + Math.random() * 0.22
      color.setHSL(hue, violet ? 0.72 : 0.35, lightness)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b

      sizes[index] = config.minSize + Math.random() * (config.maxSize - config.minSize)
      phases[index] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: config.opacity }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = -2
    return { points, parallax: config.parallax, speed: config.speed }
  }

  update(elapsed: number, delta: number, parallaxX: number, parallaxY: number): void {
    this.layers.forEach((layer) => {
      layer.points.material.uniforms.uTime.value = elapsed
      layer.points.position.x = -parallaxX * layer.parallax * 4.5
      layer.points.position.y = parallaxY * layer.parallax * 3
      layer.points.rotation.y += delta * layer.speed
    })
  }

  setPixelRatio(pixelRatio: number): void {
    this.layers.forEach((layer) => {
      layer.points.material.uniforms.uPixelRatio.value = pixelRatio
    })
  }
}
