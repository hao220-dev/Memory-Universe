<template>
  <aside class="photo-panel glass-panel" aria-live="polite">
    <button type="button" class="panel-close" aria-label="关闭详情" @click="emit('close')">
      <el-icon><Close /></el-icon>
    </button>

    <div class="panel-media">
      <img class="panel-thumb" :src="photo.thumbnailUrl" alt="" aria-hidden="true" />
      <img
        class="panel-full"
        :class="{ 'is-ready': imageState === 'ready' }"
        :src="photo.originalUrl"
        :alt="photo.title"
        @load="imageState = 'ready'"
        @error="imageState = 'error'"
      />
      <span v-if="imageState === 'loading'" class="media-status">高清影像接入中…</span>
      <span v-else-if="imageState === 'error'" class="media-status media-status--error">
        高清影像加载失败，当前展示缩略图
      </span>
    </div>

    <div class="panel-body">
      <div class="panel-meta">
        <span>{{ photo.categoryName || '未分类' }}</span>
        <span>{{ formatDate(photo.takenAt) }}</span>
      </div>

      <h2>{{ photo.title }}</h2>

      <p v-if="photo.description" class="panel-desc">{{ photo.description }}</p>
      <p v-else class="panel-desc panel-desc--empty">这段回忆还没有写下故事。</p>

      <p class="panel-location">
        <el-icon><Location /></el-icon>
        {{ photo.location || '未记录坐标' }}
      </p>

      <div class="panel-nav">
        <button type="button" class="nav-btn" :disabled="total <= 1" @click="emit('prev')">
          <el-icon><ArrowLeft /></el-icon>
          上一张
        </button>
        <span class="nav-index">{{ indexLabel }}</span>
        <button type="button" class="nav-btn" :disabled="total <= 1" @click="emit('next')">
          下一张
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>

      <div class="panel-actions">
        <a :href="photo.originalUrl" target="_blank" rel="noopener" class="mu-btn mu-btn--primary mu-btn--sm">
          查看原图
        </a>
        <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="emit('close')">
          继续漫游
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Close, Location } from '@element-plus/icons-vue'
import type { PhotoWallItem } from '@/engine/photos/types'

const props = defineProps<{
  photo: PhotoWallItem
  index: number
  total: number
}>()

const emit = defineEmits<{
  prev: []
  next: []
  close: []
}>()

const imageState = ref<'loading' | 'ready' | 'error'>('loading')

const indexLabel = computed(() => {
  if (props.total <= 0) {
    return '0 / 0'
  }
  return `${props.index + 1} / ${props.total}`
})

watch(
  () => props.photo.id,
  () => {
    imageState.value = 'loading'
  }
)

function formatDate(value?: string | null): string {
  return value ? value.replaceAll('-', '.') : '未记录日期'
}
</script>

<style scoped>
.photo-panel {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  left: 1rem;
  z-index: 20;
  max-height: 64svh;
  padding: 0.7rem;
  overflow-y: auto;
  border-radius: 22px;
}

.panel-close {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(5, 8, 22, 0.72);
  color: var(--mu-star);
  cursor: pointer;
  transition: all 0.3s ease;
}

.panel-close:hover {
  border-color: rgba(56, 189, 248, 0.6);
  color: #7dd3fc;
}

.panel-media {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  aspect-ratio: 16 / 10;
  background: #0b1530;
}

.panel-thumb,
.panel-full {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.panel-thumb {
  filter: blur(1px) saturate(0.9);
  opacity: 0.7;
  transform: scale(1.04);
}

.panel-full {
  opacity: 0;
  transition: opacity 0.5s ease;
}

.panel-full.is-ready {
  opacity: 1;
}

.media-status {
  position: absolute;
  left: 50%;
  bottom: 0.9rem;
  transform: translateX(-50%);
  padding: 0.32rem 0.85rem;
  border-radius: 999px;
  background: rgba(5, 8, 22, 0.72);
  border: 1px solid rgba(56, 189, 248, 0.24);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: rgba(203, 213, 225, 0.85);
  backdrop-filter: blur(10px);
  white-space: nowrap;
}

.media-status--error {
  border-color: rgba(248, 113, 113, 0.35);
  color: rgba(252, 165, 165, 0.9);
}

.panel-body {
  padding: 1.1rem 0.6rem 0.6rem;
}

.panel-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  color: rgba(148, 163, 184, 0.78);
}

.panel-body h2 {
  margin: 0.6rem 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.35rem;
  font-weight: 500;
  color: var(--mu-star);
}

.panel-desc {
  margin: 0.7rem 0 0;
  font-size: 0.82rem;
  line-height: 1.85;
  color: var(--mu-muted);
}

.panel-desc--empty {
  color: rgba(148, 163, 184, 0.55);
}

.panel-location {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.9rem 0 0;
  font-size: 0.72rem;
  color: rgba(148, 163, 184, 0.8);
}

.panel-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 1.2rem;
  padding-top: 0.9rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(11, 21, 48, 0.5);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: rgba(203, 213, 225, 0.85);
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover:not(:disabled) {
  border-color: rgba(56, 189, 248, 0.55);
  color: var(--mu-star);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-index {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  color: rgba(148, 163, 184, 0.7);
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}

@media (min-width: 900px) {
  .photo-panel {
    top: 8.5rem;
    right: 2.5rem;
    bottom: auto;
    left: auto;
    width: 390px;
    max-height: calc(100svh - 12rem);
    padding: 0.75rem;
  }
}
</style>
