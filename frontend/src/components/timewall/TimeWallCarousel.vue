<template>
  <div class="wall-stage">
    <div class="wall-scrim" aria-hidden="true"></div>

    <header class="stage-top">
      <p class="stage-brand"><i aria-hidden="true"></i>TIME WALL</p>
      <div class="stage-actions">
        <button
          type="button"
          class="stage-btn"
          :aria-label="paused ? '继续流动' : '暂停流动'"
          @click="togglePause"
        >
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button type="button" class="stage-btn stage-btn--exit" aria-label="退出时光墙" @click="emit('close')">
          退出
        </button>
      </div>
    </header>

    <div class="wall-rows" :class="{ 'is-paused': paused }" :style="rowsStyle">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="wall-row">
        <div class="row-track" :style="trackStyle(row, rowIndex)">
          <figure
            v-for="(photo, index) in doubleRow(row)"
            :key="`${rowIndex}-${photo.id}-${index}`"
            class="row-card"
            :title="index < row.length ? photo.title : undefined"
            :aria-hidden="index >= row.length ? 'true' : undefined"
          >
            <img
              :src="photo.thumbnailUrl"
              :alt="index < row.length ? photo.title : ''"
              draggable="false"
              decoding="async"
            />
          </figure>
        </div>
      </div>
    </div>

    <p class="wall-note">{{ photos.length }} 个瞬间 · 从左向右匀速流动</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Photo } from '@/types/domain'

const props = defineProps<{ photos: Photo[] }>()
const emit = defineEmits<{ (event: 'close'): void }>()

// 每张照片经过一次的时长，配合 linear 动画保证匀速；各行按张数换算时长，速度一致。
const SECONDS_PER_CARD = 7

const paused = ref(false)

const rows = computed(() => {
  const buckets: Photo[][] = [[], [], []]
  props.photos.forEach((photo, index) => {
    buckets[index % 3].push(photo)
  })
  return buckets.filter((row) => row.length > 0)
})

const rowsStyle = computed(() => ({
  gridTemplateRows: `repeat(${Math.max(rows.value.length, 1)}, minmax(0, 1fr))`
}))

function doubleRow(row: Photo[]): Photo[] {
  return [...row, ...row]
}

function trackStyle(row: Photo[], rowIndex: number) {
  return {
    animationDuration: `${row.length * SECONDS_PER_CARD}s`,
    animationDelay: `${rowIndex * -9}s`
  }
}

function togglePause() {
  paused.value = !paused.value
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === ' ') {
    event.preventDefault()
    togglePause()
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.wall-stage {
  position: fixed;
  inset: 0;
  z-index: 70;
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 60% at 50% 12%, rgba(56, 189, 248, 0.1), transparent 62%),
    radial-gradient(ellipse 60% 55% at 50% 96%, rgba(168, 85, 247, 0.08), transparent 60%),
    #050816;
}

.wall-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(5, 8, 22, 0.7), transparent 22%, transparent 78%, rgba(5, 8, 22, 0.86));
}

.stage-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(1rem, 2.4vw, 1.6rem) clamp(1.1rem, 3vw, 2.2rem);
}

.stage-brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.34em;
  color: rgba(186, 230, 253, 0.82);
}

.stage-brand i {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.9);
}

.stage-actions {
  display: flex;
  gap: 0.55rem;
}

.stage-btn {
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(5, 8, 22, 0.45);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: rgba(226, 232, 240, 0.82);
  cursor: pointer;
  backdrop-filter: blur(14px);
  transition: all 0.3s ease;
}

.stage-btn:hover {
  border-color: rgba(56, 189, 248, 0.5);
  color: #e0f2fe;
}

.stage-btn--exit:hover {
  border-color: rgba(248, 113, 113, 0.45);
  color: #fca5a5;
}

.wall-rows {
  --row-gap: clamp(0.75rem, 1.5vw, 1.35rem);

  position: absolute;
  inset: clamp(4.2rem, 8vh, 5.6rem) 0 clamp(2.6rem, 6vh, 3.8rem);
  z-index: 2;
  display: grid;
  gap: clamp(0.9rem, 2.2vh, 1.6rem);
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
}

.wall-row {
  display: flex;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.row-track {
  display: flex;
  align-items: center;
  height: 100%;
  width: max-content;
  animation-name: wall-flow;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.wall-rows.is-paused .row-track {
  animation-play-state: paused;
}

@keyframes wall-flow {
  from {
    transform: translateX(-50%);
  }
  to {
    transform: translateX(0);
  }
}

.row-card {
  position: relative;
  flex: 0 0 auto;
  height: 100%;
  aspect-ratio: 3 / 2;
  margin: 0 var(--row-gap) 0 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(5, 8, 22, 0.5);
  box-shadow: 0 16px 40px rgba(2, 6, 23, 0.45);
}

.row-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-drag: none;
}

.wall-note {
  position: absolute;
  right: clamp(1.1rem, 3vw, 2.2rem);
  bottom: clamp(1rem, 2.4vh, 1.6rem);
  z-index: 3;
  margin: 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  color: rgba(148, 163, 184, 0.7);
}

@media (max-width: 640px) {
  .row-card {
    border-radius: 9px;
  }

  .wall-note {
    font-size: 0.56rem;
    letter-spacing: 0.16em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .row-track {
    animation-duration: 0s;
  }
}
</style>
