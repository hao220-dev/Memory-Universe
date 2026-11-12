<template>
  <section class="subpage timeline">
    <div class="mu-container">
      <header class="subpage-head" v-reveal>
        <p class="eyebrow">Chronology</p>
        <h1 class="subpage-title display-title">
          把四年，<span class="text-gradient">按时间重新排列</span>
        </h1>
        <p class="subpage-desc">
          所有照片按拍摄时间归档。没有记录日期的照片会被放在「未标注日期」的分类里，等待你补全坐标。
        </p>
      </header>

      <div class="timeline-summary glass-panel" v-reveal>
        <div>
          <strong>{{ loading ? '···' : photos.length }}</strong>
          <span>已加载回忆</span>
        </div>
        <div>
          <strong>{{ loading ? '···' : total }}</strong>
          <span>照片总数</span>
        </div>
        <div>
          <strong>{{ loading ? '···' : groups.length }}</strong>
          <span>时间章节</span>
        </div>
        <RouterLink to="/universe" class="mu-btn mu-btn--ghost mu-btn--sm">去宇宙中漫游</RouterLink>
      </div>

      <p v-if="error" class="timeline-error">{{ error }}</p>

      <div v-if="loading" class="timeline-loading glass-panel">
        <span class="loading-orbit" aria-hidden="true"></span>
        <p>正在读取星尘时间戳…</p>
      </div>

      <div v-else-if="groups.length" class="timeline-body">
        <article v-for="group in groups" :key="group.key" class="timeline-group">
          <div class="group-rail" aria-hidden="true">
            <span class="rail-dot"></span>
            <span class="rail-line"></span>
          </div>

          <div class="group-content">
            <header class="group-head">
              <h2>{{ group.label }}</h2>
              <span>{{ group.photos.length }} 张</span>
            </header>

            <div class="group-grid">
              <button
                v-for="photo in group.photos"
                :key="photo.id"
                type="button"
                class="timeline-photo"
                @click="activePhoto = photo"
              >
                <img :src="photo.thumbnailUrl" :alt="photo.title" loading="lazy" />
                <span class="photo-caption">
                  <strong>{{ photo.title }}</strong>
                  <small>{{ photo.categoryName || '未分类' }}</small>
                </span>
              </button>
            </div>
          </div>
        </article>

        <div v-if="photos.length < total" class="load-more">
          <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '正在接收信号…' : '加载更早的回忆' }}
          </button>
        </div>
      </div>

      <div v-else class="empty-panel glass-panel">
        <p class="eyebrow">No Signals</p>
        <h2>时光轴还没有内容</h2>
        <p>上传照片并填写拍摄日期后，它们会按年份与月份自动排列在这里。</p>
        <RouterLink to="/admin/login" class="mu-btn mu-btn--primary mu-btn--sm">前往后台上传</RouterLink>
      </div>
    </div>

    <transition name="lightbox">
      <div v-if="activePhoto" class="lightbox" role="dialog" aria-modal="true" @click.self="activePhoto = null">
        <div class="lightbox-card glass-panel">
          <button type="button" class="lightbox-close" aria-label="关闭" @click="activePhoto = null">
            <el-icon><Close /></el-icon>
          </button>
          <div class="lightbox-media">
            <img :src="activePhoto.originalUrl" :alt="activePhoto.title" />
          </div>
          <div class="lightbox-body">
            <div class="lightbox-meta">
              <span>{{ activePhoto.categoryName || '未分类' }}</span>
              <span>{{ formatDate(activePhoto.takenAt) }}</span>
            </div>
            <h2>{{ activePhoto.title }}</h2>
            <p v-if="activePhoto.description">{{ activePhoto.description }}</p>
            <p class="lightbox-location">
              <el-icon><Location /></el-icon>
              {{ activePhoto.location || '未记录坐标' }}
            </p>
            <a :href="activePhoto.originalUrl" target="_blank" rel="noopener" class="mu-btn mu-btn--primary mu-btn--sm">
              查看原图
            </a>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Close, Location } from '@element-plus/icons-vue'
import { fetchPhotos } from '@/api/photo'
import type { Photo } from '@/types/domain'

interface TimelineGroup {
  key: string
  label: string
  photos: Photo[]
}

const PAGE_SIZE = 60

const photos = ref<Photo[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const activePhoto = ref<Photo | null>(null)

const groups = computed<TimelineGroup[]>(() => {
  const buckets = new Map<string, Photo[]>()
  photos.value.forEach((photo) => {
    const key = photo.takenAt ? photo.takenAt.slice(0, 7) : 'unknown'
    const list = buckets.get(key)
    if (list) {
      list.push(photo)
    } else {
      buckets.set(key, [photo])
    }
  })

  return Array.from(buckets.entries())
    .sort((a, b) => {
      if (a[0] === 'unknown') return 1
      if (b[0] === 'unknown') return -1
      return b[0].localeCompare(a[0])
    })
    .map(([key, list]) => ({
      key,
      label: key === 'unknown' ? '未标注日期' : key.replace('-', ' 年 ') + ' 月',
      photos: list
    }))
})

function formatDate(value?: string | null) {
  return value ? value.replaceAll('-', '.') : '未记录日期'
}

async function loadPage(nextPage: number) {
  const result = await fetchPhotos({ page: nextPage, size: PAGE_SIZE })
  total.value = result.total
  if (nextPage === 1) {
    photos.value = result.records
  } else {
    photos.value = [...photos.value, ...result.records]
  }
  page.value = nextPage
}

async function loadMore() {
  loadingMore.value = true
  error.value = ''
  try {
    await loadPage(page.value + 1)
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loadingMore.value = false
  }
}

onMounted(async () => {
  try {
    await loadPage(1)
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.timeline-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2.2rem;
  padding: 1.5rem 1.5rem;
  margin-bottom: 3rem;
}

.timeline-summary div {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.timeline-summary strong {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--mu-star);
}

.timeline-summary span {
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  color: var(--mu-muted);
}

.timeline-summary .mu-btn {
  margin-left: auto;
}

.timeline-error {
  margin: 0 0 1.5rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.18);
  font-size: 0.76rem;
  color: #fca5a5;
}

.timeline-loading {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1.5rem;
  font-size: 0.82rem;
  color: var(--mu-muted);
}

.loading-orbit {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-top-color: #38bdf8;
  animation: orbit 1s linear infinite;
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}

.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.timeline-group {
  display: grid;
  grid-template-columns: 1.4rem 1fr;
  gap: 1rem;
}

.group-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rail-dot {
  width: 9px;
  height: 9px;
  margin-top: 0.6rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc, #a855f7);
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.8);
}

.rail-line {
  flex: 1;
  width: 1px;
  margin-top: 0.5rem;
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.35), rgba(168, 85, 247, 0.08));
}

.group-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1rem;
}

.group-head h2 {
  margin: 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--mu-star);
}

.group-head span {
  font-size: 0.64rem;
  letter-spacing: 0.2em;
  color: var(--mu-muted);
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.timeline-photo {
  position: relative;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: #0b1530;
  cursor: pointer;
  aspect-ratio: 4 / 3;
}

.timeline-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}

.timeline-photo:hover img {
  transform: scale(1.06);
}

.photo-caption {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1.8rem 0.7rem 0.6rem;
  text-align: left;
  background: linear-gradient(180deg, transparent, rgba(5, 8, 22, 0.88));
}

.photo-caption strong {
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mu-star);
}

.photo-caption small {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: rgba(148, 163, 184, 0.8);
}

.load-more {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.empty-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
  max-width: 620px;
  padding: 2.4rem 1.8rem;
}

.empty-panel h2 {
  margin: 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--mu-star);
}

.empty-panel p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.9;
  color: var(--mu-muted);
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(10px);
}

.lightbox-card {
  position: relative;
  width: min(860px, 100%);
  max-height: 88svh;
  padding: 0.75rem;
  overflow-y: auto;
}

.lightbox-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(5, 8, 22, 0.75);
  color: var(--mu-star);
  cursor: pointer;
}

.lightbox-media {
  overflow: hidden;
  border-radius: 16px;
  max-height: 58svh;
  background: #0b1530;
}

.lightbox-media img {
  width: 100%;
  max-height: 58svh;
  object-fit: contain;
}

.lightbox-body {
  padding: 1.2rem 0.7rem 0.7rem;
}

.lightbox-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  color: rgba(148, 163, 184, 0.8);
}

.lightbox-body h2 {
  margin: 0.6rem 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--mu-star);
}

.lightbox-body p {
  margin: 0.7rem 0 0;
  font-size: 0.84rem;
  line-height: 1.9;
  color: var(--mu-muted);
}

.lightbox-location {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: rgba(148, 163, 184, 0.8);
}

.lightbox-body .mu-btn {
  margin-top: 1.2rem;
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.3s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

@media (min-width: 700px) {
  .group-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .timeline-group {
    grid-template-columns: 2rem 1fr;
    gap: 1.5rem;
  }

  .timeline-summary {
    padding: 1.7rem 2rem;
  }
}

@media (min-width: 1100px) {
  .group-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .group-head h2 {
    font-size: 1.35rem;
  }
}
</style>
