<template>
  <div
    ref="host"
    class="universe-canvas"
    :class="{ 'universe-canvas--backdrop': !interactive }"
    aria-hidden="true"
  ></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { UniverseEngine, type UniversePhoto } from '@/engine/universe/UniverseEngine'

const props = withDefaults(
  defineProps<{
    photos?: UniversePhoto[]
    interactive?: boolean
    cinematic?: boolean
  }>(),
  {
    photos: () => [],
    interactive: true,
    cinematic: false
  }
)

const emit = defineEmits<{
  select: [photo: UniversePhoto]
}>()

const host = ref<HTMLElement | null>(null)
const engine = shallowRef<UniverseEngine | null>(null)

onMounted(() => {
  if (!host.value) {
    return
  }
  engine.value = new UniverseEngine(host.value, {
    interactive: props.interactive,
    cinematic: props.cinematic,
    onSelect: (photo) => emit('select', photo)
  })
  engine.value.mount()
  engine.value.setPhotos(props.photos)
})

watch(
  () => props.photos,
  (photos) => {
    engine.value?.setPhotos(photos ?? [])
  }
)

onBeforeUnmount(() => {
  engine.value?.dispose()
  engine.value = null
})
</script>

<style scoped>
.universe-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.universe-canvas--backdrop {
  pointer-events: none;
}
</style>
