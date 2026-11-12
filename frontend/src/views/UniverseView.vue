<template>
  <section class="universe">
    <div class="universe-stage">
      <PhotoUniverseCanvas
        ref="canvasRef"
        :photos="photos"
        :layout="layout"
        @select="handleSelect"
        @deselect="handleDeselect"
      />

      <div class="stage-vignette" aria-hidden="true"></div>

      <div class="stage-ui">
        <div class="universe-intro">
          <p class="eyebrow">Deep Space Archive</p>
          <h1 class="display-title universe-title">
            照片<span class="text-gradient">宇宙</span>
          </h1>
          <p class="universe-sub">
            拖拽旋转视角，滚轮或双指缩放，点击任意照片打开一段回忆。
          </p>
        </div>

        <UniverseControlBar
          :categories="categories"
          :active-category="activeCategory"
          :layout="layout"
          :loading="loading"
          :total="photoTotal"
          :error="actionError"
          @category="selectCategory"
          @layout="changeLayout"
          @random="openRandom"
        />
      </div>

      <div v-if="!loading && !photos.length && !loadError" class="empty-space">
        <div class="glass-panel empty-card">
          <p class="eyebrow">Void Detected</p>
          <h2>这片星域还没有照片</h2>
          <p>前往馆长控制台批量上传毕业照片，它们会成为宇宙中的第一批星球。</p>
          <RouterLink to="/admin/login" class="mu-btn mu-btn--primary mu-btn--sm">前往后台上传</RouterLink>
        </div>
      </div>

      <div v-if="loadError" class="empty-space">
        <div class="glass-panel empty-card">
          <p class="eyebrow">Signal Lost</p>
          <h2>无法连接星海</h2>
          <p>{{ loadError }}</p>
          <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="loadUniverse">
            重新连接
          </button>
        </div>
      </div>

      <div class="stage-hint" aria-hidden="true">
        <span>DRAG ROTATE · SCROLL ZOOM · CLICK OPEN</span>
      </div>

      <transition name="panel">
        <PhotoDetailPanel
          v-if="selected"
          :photo="selected"
          :index="selectedIndex"
          :total="photos.length"
          @prev="step(-1)"
          @next="step(1)"
          @close="closePanel"
        />
      </transition>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PhotoUniverseCanvas from '@/components/universe/PhotoUniverseCanvas.vue'
import PhotoDetailPanel from '@/components/universe/PhotoDetailPanel.vue'
import UniverseControlBar from '@/components/universe/UniverseControlBar.vue'
import type { PhotoLayoutMode, PhotoWallItem } from '@/engine/photos/types'
import { fetchCategories } from '@/api/category'
import { fetchPhotos, fetchRandomPhoto } from '@/api/photo'
import type { Category, Photo } from '@/types/domain'

const canvasRef = ref<InstanceType<typeof PhotoUniverseCanvas> | null>(null)
const categories = ref<Category[]>([])
const photos = ref<Photo[]>([])
const photoTotal = ref(0)
const activeCategory = ref<number | null>(null)
const layout = ref<PhotoLayoutMode>('galaxy')
const selected = ref<PhotoWallItem | null>(null)
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')

const selectedIndex = computed(() => {
  if (!selected.value) {
    return 0
  }
  const index = photos.value.findIndex((photo) => photo.id === selected.value?.id)
  return index >= 0 ? index : 0
})

function handleSelect(photo: PhotoWallItem) {
  selected.value = photo
}

function handleDeselect() {
  selected.value = null
}

function closePanel() {
  selected.value = null
  canvasRef.value?.clearSelection()
}

async function loadUniverse() {
  loading.value = true
  loadError.value = ''
  try {
    const query = {
      page: 1,
      size: 100,
      ...(activeCategory.value != null ? { categoryId: activeCategory.value } : {})
    }
    const [categoryList, page] = await Promise.all([fetchCategories(), fetchPhotos(query)])
    categories.value = categoryList
    photos.value = page.records
    photoTotal.value = page.total
  } catch (cause) {
    loadError.value = (cause as Error).message
    photos.value = []
  } finally {
    loading.value = false
  }
}

function selectCategory(id: number | null) {
  if (activeCategory.value === id) {
    return
  }
  activeCategory.value = id
  selected.value = null
  actionError.value = ''
  canvasRef.value?.clearSelection()
  void loadUniverse()
}

function changeLayout(mode: PhotoLayoutMode) {
  if (layout.value === mode) {
    return
  }
  selected.value = null
  canvasRef.value?.clearSelection()
  layout.value = mode
}

function step(delta: number) {
  if (!selected.value || photos.value.length < 2) {
    return
  }
  const nextIndex = (selectedIndex.value + delta + photos.value.length) % photos.value.length
  const next = photos.value[nextIndex]
  selected.value = next
  canvasRef.value?.focusPhoto(next.id)
}

async function openRandom() {
  actionError.value = ''
  try {
    const photo = await fetchRandomPhoto()
    if (!photos.value.some((item) => item.id === photo.id)) {
      photos.value = [photo, ...photos.value]
      await nextTick()
    }
    selected.value = photo
    await nextTick()
    canvasRef.value?.focusPhoto(photo.id)
  } catch (cause) {
    actionError.value = (cause as Error).message
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!selected.value) {
    return
  }
  if (event.key === 'Escape') {
    closePanel()
  } else if (event.key === 'ArrowLeft') {
    step(-1)
  } else if (event.key === 'ArrowRight') {
    step(1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void loadUniverse()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.universe {
  position: relative;
  z-index: 1;
}

.universe-stage {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background: #050816;
}

.stage-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 45% at 18% 12%, rgba(5, 8, 22, 0.72), transparent 70%),
    linear-gradient(180deg, rgba(5, 8, 22, 0.78) 0%, transparent 26%, transparent 72%, rgba(5, 8, 22, 0.86) 100%);
}

.stage-ui {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 7rem 1.25rem 5.5rem;
  pointer-events: none;
}

.stage-ui > * {
  pointer-events: auto;
}

.universe-intro {
  max-width: 30rem;
}

.universe-title {
  margin: 0.9rem 0 0.6rem;
  font-size: clamp(2.2rem, 5vw, 3.6rem);
  color: var(--mu-star);
}

.universe-sub {
  margin: 0;
  max-width: 26rem;
  font-size: 0.8rem;
  line-height: 1.85;
  color: rgba(148, 163, 184, 0.82);
}

.stage-hint {
  position: absolute;
  right: 1.5rem;
  bottom: 1.6rem;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.32em;
  color: rgba(148, 163, 184, 0.45);
  pointer-events: none;
}

.empty-space {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 6rem 1.25rem 4rem;
  pointer-events: none;
}

.empty-card {
  max-width: 420px;
  padding: 2.2rem 1.75rem;
  text-align: left;
  pointer-events: auto;
}

.empty-card h2 {
  margin: 0.9rem 0 0.6rem;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--mu-star);
}

.empty-card p {
  margin: 0 0 1.4rem;
  font-size: 0.82rem;
  line-height: 1.85;
  color: var(--mu-muted);
}

.panel-enter-active,
.panel-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

@media (min-width: 900px) {
  .stage-ui {
    padding: 8.5rem 3rem 3.5rem;
  }

  .panel-enter-from,
  .panel-leave-to {
    opacity: 0;
    transform: translateX(28px);
  }
}
</style>
