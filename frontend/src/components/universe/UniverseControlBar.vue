<template>
  <div class="control-bar">
    <div class="filter-row" role="tablist" aria-label="按分类筛选">
      <button
        type="button"
        class="chip"
        :class="{ 'is-active': activeCategory === null }"
        @click="emit('category', null)"
      >
        全部
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="chip"
        :class="{ 'is-active': activeCategory === category.id }"
        @click="emit('category', category.id)"
      >
        {{ category.name }}
        <small>{{ category.photoCount }}</small>
      </button>
    </div>

    <div class="control-row">
      <div class="layout-switch" role="tablist" aria-label="空间布局">
        <button
          v-for="item in layoutOptions"
          :key="item.value"
          type="button"
          class="layout-btn"
          :class="{ 'is-active': layout === item.value }"
          @click="emit('layout', item.value)"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.en }}</small>
        </button>
      </div>

      <button type="button" class="mu-btn mu-btn--primary mu-btn--sm random-btn" @click="emit('random')">
        <el-icon><MagicStick /></el-icon>
        随机回忆
      </button>
    </div>

    <div class="stage-status">
      <span class="status-pill">{{ loading ? '正在校准星图' : `${total} 颗星球在轨` }}</span>
      <span v-if="error" class="stage-error">{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MagicStick } from '@element-plus/icons-vue'
import type { PhotoLayoutMode } from '@/engine/photos/types'
import type { Category } from '@/types/domain'

defineProps<{
  categories: Category[]
  activeCategory: number | null
  layout: PhotoLayoutMode
  loading: boolean
  total: number
  error: string
}>()

const emit = defineEmits<{
  category: [id: number | null]
  layout: [mode: PhotoLayoutMode]
  random: []
}>()

const layoutOptions: { value: PhotoLayoutMode; label: string; en: string }[] = [
  { value: 'galaxy', label: '星系', en: 'GALAXY' },
  { value: 'spiral', label: '旋臂', en: 'SPIRAL' },
  { value: 'timeline', label: '时光', en: 'TIMELINE' }
]
</script>

<style scoped>
.control-bar {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.filter-row {
  display: flex;
  gap: 0.55rem;
  overflow-x: auto;
  padding-bottom: 0.35rem;
  scrollbar-width: none;
}

.filter-row::-webkit-scrollbar {
  display: none;
}

.filter-row .chip {
  flex: 0 0 auto;
  padding: 0.42rem 0.9rem;
  font-size: 0.72rem;
}

.filter-row .chip small {
  font-size: 0.6rem;
  opacity: 0.7;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.layout-switch {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.22rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(11, 21, 48, 0.55);
  backdrop-filter: blur(12px);
}

.layout-btn {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.42rem 0.85rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 0.72rem;
  color: rgba(148, 163, 184, 0.78);
  cursor: pointer;
  transition: all 0.35s ease;
}

.layout-btn small {
  font-size: 0.54rem;
  letter-spacing: 0.18em;
  opacity: 0.65;
}

.layout-btn:hover {
  color: var(--mu-star);
}

.layout-btn.is-active {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(168, 85, 247, 0.22));
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.32);
  color: #e0f2fe;
}

.random-btn {
  margin-left: auto;
}

.stage-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.stage-error {
  font-size: 0.72rem;
  color: #fca5a5;
}

@media (min-width: 900px) {
  .control-row {
    flex-wrap: nowrap;
  }

  .random-btn {
    margin-left: auto;
  }
}
</style>
