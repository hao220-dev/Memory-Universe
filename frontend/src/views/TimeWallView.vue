<template>
  <section class="time-wall" :class="{ 'is-entered': entered }">
    <div class="wall-canvas">
      <UniverseCanvas :interactive="false" />
    </div>
    <div class="wall-vignette" aria-hidden="true"></div>

    <TimeWallCarousel v-if="entered" :photos="photos" @close="entered = false" />

    <div v-else class="wall-intro">
      <p class="eyebrow">Time Wall</p>
      <h1 class="wall-title display-title">时光<span class="text-gradient">墙</span></h1>
      <p class="wall-sub">
        一张照片，一段时光，一个不想遗忘的故事。<br />
        点击进入，让生活里的片段铺满整面墙。
      </p>
      <button
        type="button"
        class="mu-btn mu-btn--primary wall-enter"
        :disabled="loading || !photos.length"
        @click="enter"
      >
        {{ loading ? '正在收集时光…' : '点击进入时光墙' }}
        <span class="arrow">→</span>
      </button>
      <p v-if="error" class="wall-note wall-note--error">{{ error }}</p>
      <p v-else-if="!loading && photos.length" class="wall-note">
        共 {{ photos.length }} 个瞬间等待被看见
      </p>
      <p v-else-if="!loading" class="wall-note">照片墙还是空的，先去照片宇宙留下一些瞬间吧。</p>
    </div>

    <p v-if="!entered" class="wall-footer">MEMORY UNIVERSE · MOMENTS OF LIFE</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UniverseCanvas from '@/components/universe/UniverseCanvas.vue'
import TimeWallCarousel from '@/components/timewall/TimeWallCarousel.vue'
import { fetchPhotos } from '@/api/photo'
import type { Photo } from '@/types/domain'

const photos = ref<Photo[]>([])
const loading = ref(true)
const entered = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchPhotos({ page: 1, size: 100 })
    photos.value = result.records
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loading.value = false
  }
}

function enter() {
  if (!photos.value.length) {
    return
  }
  entered.value = true
}

onMounted(load)
</script>

<style scoped>
.time-wall {
  position: relative;
  z-index: 1;
  min-height: 100svh;
  overflow: hidden;
  background: #050816;
}

.wall-canvas {
  position: absolute;
  inset: 0;
  opacity: 0.9;
}

.wall-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 55% 45% at 50% 48%, rgba(5, 8, 22, 0.24), transparent 68%),
    linear-gradient(180deg, rgba(5, 8, 22, 0.68) 0%, transparent 30%, transparent 70%, rgba(5, 8, 22, 0.9) 100%);
}

.wall-intro {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100svh;
  padding: 7rem 1.5rem 5rem;
  text-align: center;
}

.wall-title {
  margin: 1.2rem 0 1.3rem;
  font-size: clamp(2.6rem, 6.8vw, 5rem);
  color: var(--mu-star);
}

.wall-sub {
  margin: 0 0 2.1rem;
  font-size: 0.9rem;
  line-height: 2;
  color: rgba(203, 213, 225, 0.76);
}

.wall-enter .arrow {
  transition: transform 0.35s ease;
}

.wall-enter:hover .arrow {
  transform: translateX(4px);
}

.wall-enter:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.wall-note {
  margin: 1.1rem 0 0;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.72);
}

.wall-note--error {
  color: #fca5a5;
}

.wall-footer {
  position: absolute;
  bottom: 1.8rem;
  left: 50%;
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.34em;
  white-space: nowrap;
  color: rgba(148, 163, 184, 0.42);
  transform: translateX(-50%);
}

@media (max-width: 640px) {
  .wall-sub {
    font-size: 0.82rem;
    line-height: 1.95;
  }
}
</style>
