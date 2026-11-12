<template>
  <button
    type="button"
    class="music-toggle"
    :class="{ 'is-playing': music.playing }"
    :aria-pressed="music.playing"
    :aria-label="music.playing ? '暂停环境音乐（双击切换下一首）' : '播放环境音乐（双击切换下一首）'"
    :title="music.playing ? '单击暂停 · 双击切换下一首' : '单击播放 · 双击切换下一首'"
    @click="handleClick"
  >
    <span class="music-bars" aria-hidden="true">
      <i></i>
      <i></i>
      <i></i>
      <i></i>
    </span>
    <span class="music-label">MUSIC</span>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
const CLICK_DELAY = 300
const DOUBLE_CLICK_INTERVAL = 320

let clickTimer = 0
let lastClickAt = 0

function handleClick(event: MouseEvent) {
  const now = performance.now()
  const hadPending = clickTimer !== 0
  window.clearTimeout(clickTimer)
  clickTimer = 0

  // 上一次单击尚未执行时，本次点击视为新的单击起手，不参与连击判断。
  const rapid =
    !hadPending && lastClickAt > 0 && now - lastClickAt <= DOUBLE_CLICK_INTERVAL
  lastClickAt = now

  // 第二次点击（原生 detail 为偶数，或与上一次点击间隔很短）视为双击切歌。
  const doubleClick = (event.detail >= 2 && event.detail % 2 === 0) || rapid
  if (doubleClick) {
    lastClickAt = 0
    void music.nextTrack()
    return
  }
  if (event.detail > 2) {
    return
  }
  clickTimer = window.setTimeout(() => {
    clickTimer = 0
    // 本次单击已完成，重置计时，避免下一次双击的第一下被误判为连击。
    lastClickAt = 0
    void music.toggle()
  }, CLICK_DELAY)
}

onBeforeUnmount(() => {
  window.clearTimeout(clickTimer)
})
</script>

<style scoped>
.music-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.1rem;
  padding: 0 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  background: rgba(5, 8, 22, 0.32);
  color: rgba(203, 213, 225, 0.72);
  cursor: pointer;
  backdrop-filter: blur(12px);
  user-select: none;
  -webkit-user-select: none;
  transition:
    border-color 0.35s ease,
    color 0.35s ease,
    background 0.35s ease;
}

.music-toggle:hover {
  border-color: rgba(56, 189, 248, 0.42);
  color: #e0f2fe;
}

.music-toggle.is-playing {
  border-color: rgba(56, 189, 248, 0.4);
  background: rgba(56, 189, 248, 0.08);
  color: #bae6fd;
}

.music-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 0.75rem;
}

.music-bars i {
  width: 2px;
  height: 3px;
  border-radius: 2px;
  background: currentColor;
  opacity: 0.55;
  transition: height 0.3s ease;
}

.is-playing .music-bars i {
  opacity: 1;
  animation: bar-wave 1.4s ease-in-out infinite;
}

.is-playing .music-bars i:nth-child(2) {
  animation-delay: 0.18s;
}

.is-playing .music-bars i:nth-child(3) {
  animation-delay: 0.36s;
}

.is-playing .music-bars i:nth-child(4) {
  animation-delay: 0.12s;
}

@keyframes bar-wave {
  0%,
  100% {
    height: 3px;
  }
  50% {
    height: 11px;
  }
}

.music-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.22em;
}

@media (prefers-reduced-motion: reduce) {
  .is-playing .music-bars i {
    animation: none;
    height: 8px;
  }
}
</style>
