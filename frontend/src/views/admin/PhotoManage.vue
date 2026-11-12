<template>
  <div class="photo-manage">
    <header class="manage-head glass-panel">
      <div>
        <p class="eyebrow">Memory Planets</p>
        <h2>照片管理</h2>
        <p class="manage-desc">
          支持批量上传（自动生成 720px 缩略图）、编辑信息、控制前台可见性与删除。删除会同时清理原图与缩略图对象。
        </p>
      </div>
      <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" @click="openUpload">批量上传</button>
    </header>

    <div class="filter-bar glass-panel">
      <el-select v-model="filters.categoryId" placeholder="全部分类" clearable class="filter-select" @change="applyFilters">
        <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-input
        v-model="filters.keyword"
        placeholder="搜索标题"
        clearable
        class="filter-input"
        @keyup.enter="applyFilters"
        @clear="applyFilters"
      />
      <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="applyFilters">筛选</button>
      <span class="filter-total">共 {{ total }} 张</span>
    </div>

    <p v-if="error" class="manage-error">{{ error }}</p>

    <div class="table-panel glass-panel">
      <el-table v-loading="loading" :data="photos" style="width: 100%" empty-text="还没有照片，点击右上角批量上传">
        <el-table-column label="预览" width="110">
          <template #default="{ row }">
            <img :src="row.thumbnailUrl" :alt="row.title" class="thumb" loading="lazy" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="分类" width="120">
          <template #default="{ row }">
            <span class="cell-muted">{{ row.categoryName || '未分类' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="takenAt" label="拍摄日期" width="120">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatDate(row.takenAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="大小" width="100">
          <template #default="{ row }">
            <span class="cell-muted">{{ formatSize(row.fileSize) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可见" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.visible" @change="(value: boolean) => toggleVisible(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <el-dialog v-model="uploadVisible" title="批量上传照片" width="min(640px, 94vw)" destroy-on-close>
      <div class="dialog-body">
        <el-upload
          v-model:file-list="fileList"
          drag
          multiple
          accept="image/jpeg,image/png"
          :auto-upload="false"
          :limit="20"
        >
          <div class="upload-hint">
            <el-icon :size="28"><UploadFilled /></el-icon>
            <p>拖拽照片到这里，或点击选择</p>
            <small>仅支持 JPG / PNG，单张不超过 20MB，一次最多 20 张</small>
          </div>
        </el-upload>

        <el-form label-position="top" class="upload-form">
          <el-form-item label="归档分类">
            <el-select v-model="uploadForm.categoryId" placeholder="可选：选择分类" clearable style="width: 100%">
              <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="标题前缀">
            <el-input v-model="uploadForm.title" maxlength="120" placeholder="留空则使用文件名；多张时会自动追加序号" />
          </el-form-item>
          <el-form-item label="拍摄日期">
            <el-date-picker
              v-model="uploadForm.takenAt"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="地点">
            <el-input v-model="uploadForm.location" maxlength="120" placeholder="例如：图书馆前草坪" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="uploadForm.description" type="textarea" :rows="2" maxlength="1000" show-word-limit />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="uploadVisible = false">取消</button>
        <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" :disabled="uploading" @click="submitUpload">
          {{ uploading ? '正在上传…' : `上传 ${fileList.length || ''} 张` }}
        </button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑照片" width="min(560px, 94vw)" destroy-on-close>
      <el-form v-if="editing" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" maxlength="120" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.categoryId" placeholder="未分类" clearable style="width: 100%">
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="拍摄日期">
          <el-date-picker
            v-model="editForm.takenAt"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="editForm.location" maxlength="120" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editForm.sortOrder" :min="0" :max="9999" />
        </el-form-item>
      </el-form>

      <template #footer>
        <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="editVisible = false">取消</button>
        <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" :disabled="saving" @click="saveEdit">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadRawFile, type UploadUserFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import {
  deletePhoto,
  fetchAdminPhotos,
  updatePhoto,
  uploadPhotos,
  type PhotoUpdatePayload
} from '@/api/admin'
import { fetchAdminCategories } from '@/api/admin'
import type { Category, Photo } from '@/types/domain'

const photos = ref<Photo[]>([])
const categories = ref<Category[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')

const filters = reactive({
  page: 1,
  size: 10,
  categoryId: undefined as number | undefined,
  keyword: ''
})

const uploadVisible = ref(false)
const uploading = ref(false)
const fileList = ref<UploadUserFile[]>([])
const uploadForm = reactive({
  categoryId: undefined as number | undefined,
  title: '',
  description: '',
  takenAt: '',
  location: ''
})

const editVisible = ref(false)
const saving = ref(false)
const editing = ref<Photo | null>(null)
const editForm = reactive({
  title: '',
  description: '',
  categoryId: undefined as number | undefined,
  takenAt: '',
  location: '',
  sortOrder: 0
})

function formatDate(value?: string | null) {
  return value || '—'
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAdminPhotos({
      page: filters.page,
      size: filters.size,
      categoryId: filters.categoryId,
      keyword: filters.keyword.trim() || undefined
    })
    photos.value = result.records
    total.value = result.total
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  filters.page = 1
  void load()
}

function handleSizeChange() {
  filters.page = 1
  void load()
}

function openUpload() {
  fileList.value = []
  uploadForm.categoryId = undefined
  uploadForm.title = ''
  uploadForm.description = ''
  uploadForm.takenAt = ''
  uploadForm.location = ''
  uploadVisible.value = true
}

async function submitUpload() {
  const files = fileList.value
    .map((item) => item.raw)
    .filter((raw): raw is UploadRawFile => Boolean(raw))

  if (!files.length) {
    ElMessage.warning('请先选择照片')
    return
  }

  uploading.value = true
  try {
    const created = await uploadPhotos(files, {
      categoryId: uploadForm.categoryId,
      title: uploadForm.title.trim() || undefined,
      description: uploadForm.description.trim() || undefined,
      takenAt: uploadForm.takenAt || undefined,
      location: uploadForm.location.trim() || undefined
    })
    ElMessage.success(`已上传 ${created.length} 张照片`)
    uploadVisible.value = false
    filters.page = 1
    await load()
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  } finally {
    uploading.value = false
  }
}

function openEdit(photo: Photo) {
  editing.value = photo
  editForm.title = photo.title
  editForm.description = photo.description ?? ''
  editForm.categoryId = photo.categoryId ?? undefined
  editForm.takenAt = photo.takenAt ?? ''
  editForm.location = photo.location ?? ''
  editForm.sortOrder = photo.sortOrder
  editVisible.value = true
}

async function saveEdit() {
  if (!editing.value) {
    return
  }
  if (!editForm.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }

  const payload: PhotoUpdatePayload = {
    title: editForm.title.trim(),
    description: editForm.description.trim() || null,
    categoryId: editForm.categoryId ?? null,
    takenAt: editForm.takenAt || null,
    location: editForm.location.trim() || null,
    sortOrder: editForm.sortOrder
  }

  saving.value = true
  try {
    await updatePhoto(editing.value.id, payload)
    ElMessage.success('照片已更新')
    editVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  } finally {
    saving.value = false
  }
}

async function toggleVisible(photo: Photo, value: boolean) {
  try {
    await updatePhoto(photo.id, { visible: value })
    photo.visible = value
    ElMessage.success(value ? '已设为前台可见' : '已从前台隐藏')
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  }
}

async function remove(photo: Photo) {
  try {
    await ElMessageBox.confirm(`确定删除「${photo.title}」吗？原图与缩略图会一并清理。`, '删除照片', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await deletePhoto(photo.id)
    ElMessage.success('照片已删除')
    if (photos.value.length === 1 && filters.page > 1) {
      filters.page -= 1
    }
    await load()
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  }
}

onMounted(async () => {
  try {
    categories.value = await fetchAdminCategories()
  } catch (cause) {
    error.value = (cause as Error).message
  }
  await load()
})
</script>

<style scoped>
.photo-manage {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.manage-head {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 1.7rem 1.5rem;
}

.manage-head h2 {
  margin: 0.7rem 0 0.45rem;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--mu-star);
}

.manage-desc {
  max-width: 46rem;
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.8;
  color: var(--mu-muted);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  padding: 0.9rem 1rem;
}

.filter-select {
  width: 150px;
}

.filter-input {
  width: min(260px, 100%);
}

.filter-total {
  margin-left: auto;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--mu-muted);
}

.manage-error {
  margin: 0;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.18);
  font-size: 0.76rem;
  color: #fca5a5;
}

.table-panel {
  padding: 0.85rem;
}

.thumb {
  width: 76px;
  height: 54px;
  border-radius: 8px;
  object-fit: cover;
  background: #0b1530;
}

.cell-muted {
  color: var(--mu-muted);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 0.4rem 0.3rem;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1.3rem;
}

.upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.3rem 0;
  color: var(--mu-muted);
}

.upload-hint p {
  margin: 0;
  font-size: 0.84rem;
  color: var(--mu-star);
}

.upload-hint small {
  font-size: 0.68rem;
  color: var(--mu-muted);
}

.upload-form {
  margin-top: 0.2rem;
}

:deep(.el-upload-dragger) {
  background: rgba(5, 8, 22, 0.5);
  border: 1px dashed rgba(56, 189, 248, 0.3);
  border-radius: 14px;
}

:deep(.el-upload-dragger:hover) {
  border-color: rgba(56, 189, 248, 0.6);
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(11, 21, 48, 0.6);
  --el-table-border-color: rgba(148, 163, 184, 0.12);
  --el-table-text-color: rgba(226, 232, 240, 0.88);
  --el-table-header-text-color: #cbd5e1;
  --el-table-row-hover-bg-color: rgba(56, 189, 248, 0.06);
  border-radius: 14px;
  background: transparent;
}

:deep(.el-table__inner-wrapper::before) {
  display: none;
}

:deep(.el-pagination) {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: #cbd5e1;
  --el-pagination-button-bg-color: rgba(11, 21, 48, 0.6);
}

@media (min-width: 780px) {
  .manage-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 2rem;
  }

  .table-panel {
    padding: 1rem;
  }
}
</style>
