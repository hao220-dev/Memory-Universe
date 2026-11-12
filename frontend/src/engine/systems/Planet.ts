import * as THREE from 'three'
import type { ResourceManager } from '../core/ResourceManager'
import type { QualityProfile } from '../core/RendererManager'

const coreVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const coreFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    float bands = sin(vUv.y * 54.0 + uTime * 0.35) * 0.5 + 0.5;
    float fine = sin(vUv.y * 132.0 - uTime * 0.18) * 0.5 + 0.5;

    vec3 deep = vec3(0.015, 0.035, 0.11);
    vec3 ocean = vec3(0.03, 0.28, 0.58);
    vec3 violet = vec3(0.45, 0.26, 0.86);

    vec3 color = mix(deep, ocean, bands * 0.38 + fine * 0.16);
    color += violet * pow(bands, 2.4) * 0.28;

    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.6);
    color += vec3(0.24, 0.68, 1.0) * fresnel * 1.5;
    color += vec3(0.55, 0.4, 0.98) * pow(fresnel, 3.0) * 1.2;

    gl_FragColor = vec4(color, 1.0);
  }
`

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const atmosphereFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;

  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 3.2);
    float pulse = 0.86 + 0.14 * sin(uTime * 0.9);
    vec3 color = mix(vec3(0.16, 0.58, 1.0), vec3(0.68, 0.4, 0.98), vUv.y);
    gl_FragColor = vec4(color * rim * 1.6 * pulse, rim * 0.85);
  }
`

const ringVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ringFragment = /* glsl */ `
  uniform float uInnerRatio;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float distanceToCenter = length(vUv - 0.5) * 2.0;
    float innerEdge = smoothstep(uInnerRatio - 0.05, uInnerRatio + 0.04, distanceToCenter);
    float outerEdge = 1.0 - smoothstep(0.9, 1.0, distanceToCenter);
    float alpha = innerEdge * outerEdge * uOpacity;
    vec3 color = mix(uColorA, uColorB, vUv.x);
    gl_FragColor = vec4(color, alpha);
  }
`

function createGlowTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(180, 230, 255, 0.95)')
    gradient.addColorStop(0.22, 'rgba(96, 165, 250, 0.5)')
    gradient.addColorStop(0.55, 'rgba(124, 58, 237, 0.16)')
    gradient.addColorStop(1, 'rgba(5, 8, 22, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 中央发光星球：程序化地表着色器 + 大气层边缘光 + 轨道环 + 环绕粒子。
 */
export class Planet {
  readonly group = new THREE.Group()
  readonly position = new THREE.Vector3(0, 0, -18)

  private readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  private readonly atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  private readonly glow: THREE.Sprite
  private readonly rings: THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>[] = []
  private readonly orbitParticles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>

  constructor(profile: QualityProfile, resources: ResourceManager) {
    const glowTexture = createGlowTexture()

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(4.6, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        uniforms: {
          uTime: { value: 0 }
        }
      })
    )
    this.group.add(this.core)

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(5.35, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          uTime: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.group.add(this.atmosphere)

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.glow = new THREE.Sprite(glowMaterial)
    this.glow.scale.set(27, 27, 1)
    this.group.add(this.glow)

    const ringConfigs = [
      { inner: 6.4, outer: 6.8, tiltX: Math.PI / 2 - 0.22, tiltY: 0, speed: 0.16, colorA: 0x38bdf8, colorB: 0xa855f7, opacity: 0.55 },
      { inner: 7.4, outer: 7.9, tiltX: Math.PI / 2 + 0.26, tiltY: 0.35, speed: -0.11, colorA: 0x818cf8, colorB: 0xe879f9, opacity: 0.4 },
      { inner: 9.2, outer: 9.55, tiltX: Math.PI / 2 - 0.52, tiltY: -0.28, speed: 0.07, colorA: 0x22d3ee, colorB: 0x7c3aed, opacity: 0.28 }
    ]

    ringConfigs.forEach((config) => {
      const geometry = new THREE.RingGeometry(config.inner, config.outer, 192, 1)
      const material = new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        uniforms: {
          uInnerRatio: { value: config.inner / config.outer },
          uColorA: { value: new THREE.Color(config.colorA) },
          uColorB: { value: new THREE.Color(config.colorB) },
          uOpacity: { value: config.opacity }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const ring = new THREE.Mesh(geometry, material)
      ring.rotation.x = config.tiltX
      ring.rotation.y = config.tiltY
      ring.userData.speed = config.speed
      this.rings.push(ring)
      this.group.add(ring)
    })

    const count = profile.orbitParticleCount
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 5.6 + Math.random() * 5.4
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = (Math.random() - 0.5) * 1.4
      positions[index * 3 + 2] = Math.sin(angle) * radius
      color.setHSL(0.56 + Math.random() * 0.18, 0.72, 0.68 + Math.random() * 0.2)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    const orbitGeometry = new THREE.BufferGeometry()
    orbitGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    orbitGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.orbitParticles = new THREE.Points(
      orbitGeometry,
      new THREE.PointsMaterial({
        size: 0.16,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })
    )
    this.orbitParticles.rotation.x = 0.24
    this.group.add(this.orbitParticles)

    this.group.position.copy(this.position)
    resources.trackObject(this.group)
  }

  update(elapsed: number, delta: number): void {
    this.core.material.uniforms.uTime.value = elapsed
    this.atmosphere.material.uniforms.uTime.value = elapsed
    this.core.rotation.y += delta * 0.05

    this.rings.forEach((ring) => {
      ring.rotation.z += delta * (ring.userData.speed as number)
    })
    this.orbitParticles.rotation.z -= delta * 0.08

    const pulse = 1 + Math.sin(elapsed * 0.9) * 0.05
    this.glow.scale.set(27 * pulse, 27 * pulse, 1)
    ;(this.glow.material as THREE.SpriteMaterial).opacity =
      0.45 + Math.sin(elapsed * 0.9) * 0.1
  }
}
