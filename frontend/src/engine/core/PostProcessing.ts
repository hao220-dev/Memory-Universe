import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { QualityProfile } from './RendererManager'
import type { ResourceManager } from './ResourceManager'

/**
 * 后期处理管线：HDR RenderTarget + UnrealBloom + 输出色彩空间转换。
 * 低画质设备不创建该管线，直接走原生 renderer.render。
 */
export class PostProcessing {
  private readonly composer: EffectComposer
  private readonly bloomPass: UnrealBloomPass
  private readonly renderPass: RenderPass
  private readonly outputPass: OutputPass
  private readonly resolutionScale: number

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    profile: QualityProfile,
    resources: ResourceManager
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    const target = new THREE.WebGLRenderTarget(Math.max(size.x, 1), Math.max(size.y, 1), {
      type: THREE.HalfFloatType,
      samples: profile.antialias ? 2 : 0
    })

    this.composer = new EffectComposer(renderer, target)
    this.resolutionScale = profile.bloomResolutionScale

    this.renderPass = new RenderPass(scene, camera)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      profile.bloomStrength,
      profile.bloomRadius,
      profile.bloomThreshold
    )
    this.outputPass = new OutputPass()

    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.outputPass)

    resources.addCleanup(() => {
      this.renderPass.dispose()
      this.bloomPass.dispose()
      this.outputPass.dispose()
      this.composer.dispose()
    })
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
    this.bloomPass.setSize(
      Math.max(1, Math.round(width * this.resolutionScale)),
      Math.max(1, Math.round(height * this.resolutionScale))
    )
  }

  render(): void {
    this.composer.render()
  }
}
