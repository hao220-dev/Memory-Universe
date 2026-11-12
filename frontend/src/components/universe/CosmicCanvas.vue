<template>
  <div ref="host" class="cosmic-canvas" aria-hidden="true">
    <transition name="fallback">
      <div v-if="unavailable" class="canvas-fallback">
        <span class="fallback-ring">
          <i></i>
          <i></i>
        </span>
        <p>当前设备未能启用 WebGL，3D 星海暂不可用</p>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { CosmicEngine } from '@/engine/cosmic/CosmicEngine'
import type { QualityLevel } from '@/engine/core/RendererManager'

const props = withDefaults(
  defineProps<{
    quality?: QualityLevel | 'auto'
    interactive?: boolean
    parallax?: boolean
    intro?: boolean
  }>(),
  {
    quality: 'auto',
    interactive: false,
    parallax: true,
    intro: true
  }
)

const emit = defineEmits<{
  ready: []
  unavailable: [reason: string]
  contextLost: []
  contextRestored: []
}>()

const host = ref<HTMLElement | null>(null)
const engine = shallowRef<CosmicEngine | null>(null)
const unavailable = ref(false)

onMounted(() => {
  if (!host.value) {
    return
  }
  engine.value = new CosmicEngine(host.value, {
    quality: props.quality,
    interactive: props.interactive,
    parallax: props.parallax,
    intro: props.intro,
    onReady: () => emit('ready'),
    onUnavailable: (reason) => {
      unavailable.value = true
      emit('unavailable', reason)
    },
    onContextLost: () => emit('contextLost'),
    onContextRestored: () => emit('contextRestored')
  })
  engine.value.mount()
})

onBeforeUnmount(() => {
  engine.value?.dispose()
  engine.value = null
})
</script>

<style scoped>
.cosmic-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  background:
    radial-gradient(ellipse 50% 40% at 50% 46%, rgba(56, 189, 248, 0.08), transparent 70%),
    radial-gradient(ellipse 36% 30% at 62% 58%, rgba(168, 85, 247, 0.08), transparent 72%),
    #050816;
}

.canvas-fallback p {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: rgba(148, 163, 184, 0.72);
}

.fallback-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
}

.fallback-ring i {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.3);
}

.fallback-ring i:last-child {
  inset: 0.75rem;
  border-color: rgba(168, 85, 247, 0.4);
}

.fallback-enter-active {
  transition: opacity 0.6s ease;
}

.fallback-enter-from {
  opacity: 0;
}
</style>
