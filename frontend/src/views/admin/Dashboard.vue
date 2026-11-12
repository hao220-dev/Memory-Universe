<template>
  <div class="dashboard">
    <section class="dash-hero glass-panel">
      <div>
        <p class="eyebrow">Mission Control</p>
        <h2 class="dash-title">今天也要好好收藏宇宙</h2>
        <p class="dash-desc">
          这里是馆长控制台。数据全部来自真实后端接口，上传照片后统计与最新回忆会立即更新。
        </p>
      </div>
      <div class="dash-actions">
        <RouterLink to="/admin/photos" class="mu-btn mu-btn--primary mu-btn--sm">上传照片</RouterLink>
        <RouterLink to="/" class="mu-btn mu-btn--ghost mu-btn--sm">查看主站</RouterLink>
      </div>
    </section>

    <p v-if="error" class="dash-error">{{ error }}</p>

    <section class="stat-grid">
      <article class="stat-card glass-panel">
        <span class="stat-icon"><el-icon><Picture /></el-icon></span>
        <div>
          <strong>{{ loading ? '···' : photoTotal }}</strong>
          <span>照片总数</span>
        </div>
      </article>
      <article class="stat-card glass-panel">
        <span class="stat-icon"><el-icon><Collection /></el-icon></span>
        <div>
          <strong>{{ loading ? '···' : categories.length }}</strong>
          <span>记忆分类</span>
        </div>
      </article>
      <article class="stat-card glass-panel">
        <span class="stat-icon"><el-icon><ChatDotRound /></el-icon></span>
        <div>
          <strong>—</strong>
          <span>待审核留言（未接入）</span>
        </div>
      </article>
      <article class="stat-card glass-panel">
        <span class="stat-icon"><el-icon><Headset /></el-icon></span>
        <div>
          <strong>—</strong>
          <span>背景音乐（未接入）</span>
        </div>
      </article>
    </section>

    <section class="dash-columns">
      <article class="dash-panel glass-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">Latest Signals</p>
            <h3>最新上传</h3>
          </div>
          <RouterLink to="/admin/photos" class="panel-link">全部照片 →</RouterLink>
        </header>

        <div v-if="loading" class="panel-loading">正在读取星图数据…</div>

        <ul v-else-if="recentPhotos.length" class="recent-list">
          <li v-for="photo in recentPhotos" :key="photo.id">
            <img :src="photo.thumbnailUrl" :alt="photo.title" loading="lazy" />
            <div>
              <strong>{{ photo.title }}</strong>
              <span>{{ photo.categoryName || '未分类' }} · {{ formatDate(photo.takenAt) }}</span>
            </div>
            <span class="recent-size">{{ formatSize(photo.fileSize) }}</span>
          </li>
        </ul>

        <div v-else class="panel-empty">
          <p>还没有照片。先上传第一批毕业照片，宇宙才会亮起来。</p>
          <RouterLink to="/admin/photos" class="mu-btn mu-btn--ghost mu-btn--sm">去上传</RouterLink>
        </div>
      </article>

      <article class="dash-panel glass-panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">Star Systems</p>
            <h3>记忆星系</h3>
          </div>
          <RouterLink to="/admin/categories" class="panel-link">管理分类 →</RouterLink>
        </header>

        <ul v-if="categories.length" class="category-list">
          <li v-for="category in categories" :key="category.id">
            <span class="category-dot"></span>
            <div>
              <strong>{{ category.name }}</strong>
              <span>{{ category.slug }}</span>
            </div>
            <span class="category-count">{{ category.photoCount }}</span>
          </li>
        </ul>

        <div v-else-if="!loading" class="panel-empty">
          <p>还没有分类。先创建「军训」「毕业照」等记忆星系，上传时更方便归档。</p>
          <RouterLink to="/admin/categories" class="mu-btn mu-btn--ghost mu-btn--sm">创建分类</RouterLink>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChatDotRound, Collection, Headset, Picture } from '@element-plus/icons-vue'
import { fetchCategories } from '@/api/category'
import { fetchPhotos } from '@/api/photo'
import type { Category, Photo } from '@/types/domain'

const categories = ref<Category[]>([])
const recentPhotos = ref<Photo[]>([])
const photoTotal = ref(0)
const loading = ref(true)
const error = ref('')

function formatDate(value?: string | null) {
  return value ? value.replaceAll('-', '.') : '未记录'
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

onMounted(async () => {
  try {
    const [categoryList, recent] = await Promise.all([
      fetchCategories(),
      fetchPhotos({ page: 1, size: 5 })
    ])
    categories.value = categoryList
    recentPhotos.value = recent.records
    photoTotal.value = recent.total
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dash-hero {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem 1.5rem;
}

.dash-title {
  margin: 0.9rem 0 0.6rem;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 600;
  color: var(--mu-star);
}

.dash-desc {
  max-width: 40rem;
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.85;
  color: var(--mu-muted);
}

.dash-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.dash-error {
  margin: 0;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.18);
  font-size: 0.76rem;
  color: #fca5a5;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.3rem 1.15rem;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  flex-shrink: 0;
  border-radius: 14px;
  border: 1px solid rgba(56, 189, 248, 0.26);
  background: rgba(56, 189, 248, 0.08);
  color: #7dd3fc;
}

.stat-card strong {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--mu-star);
}

.stat-card div span {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  color: var(--mu-muted);
}

.dash-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.dash-panel {
  padding: 1.5rem 1.25rem;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.panel-head h3 {
  margin: 0.55rem 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--mu-star);
}

.panel-link {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #7dd3fc;
  white-space: nowrap;
}

.panel-loading,
.panel-empty p {
  margin: 1.4rem 0 0;
  font-size: 0.8rem;
  line-height: 1.8;
  color: var(--mu-muted);
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.recent-list,
.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.recent-list li {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.55rem;
  border-radius: 12px;
  transition: background 0.3s ease;
}

.recent-list li:hover {
  background: rgba(56, 189, 248, 0.05);
}

.recent-list img {
  width: 3.2rem;
  height: 2.4rem;
  flex-shrink: 0;
  border-radius: 8px;
  object-fit: cover;
  background: #0b1530;
}

.recent-list div {
  min-width: 0;
}

.recent-list strong {
  display: block;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mu-star);
}

.recent-list div span {
  display: block;
  margin-top: 0.22rem;
  font-size: 0.66rem;
  color: var(--mu-muted);
}

.recent-size {
  margin-left: auto;
  font-size: 0.64rem;
  color: rgba(148, 163, 184, 0.7);
}

.category-list li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.7rem 0.55rem;
  border-radius: 10px;
}

.category-list li:hover {
  background: rgba(168, 85, 247, 0.05);
}

.category-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a855f7;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.8);
}

.category-list div {
  min-width: 0;
}

.category-list strong {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--mu-star);
}

.category-list div span {
  display: block;
  margin-top: 0.18rem;
  font-size: 0.64rem;
  color: var(--mu-muted);
}

.category-count {
  margin-left: auto;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.65rem;
  color: #7dd3fc;
}

@media (min-width: 780px) {
  .dash-hero {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 2.2rem 2rem;
  }

  .stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dash-columns {
    grid-template-columns: 1.15fr 0.85fr;
  }

  .dash-panel {
    padding: 1.7rem 1.6rem;
  }
}
</style>
