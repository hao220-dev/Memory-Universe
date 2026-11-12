<template>
  <div class="category-manage">
    <header class="manage-head glass-panel">
      <div>
        <p class="eyebrow">Star Systems</p>
        <h2>分类管理</h2>
        <p class="manage-desc">
          分类即记忆星系。name 用于前台展示，slug 用于接口与路由标识，需保持唯一。
        </p>
      </div>
      <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" @click="openCreate">
        新建分类
      </button>
    </header>

    <p v-if="error" class="manage-error">{{ error }}</p>

    <div class="table-panel glass-panel">
      <el-table v-loading="loading" :data="categories" style="width: 100%" empty-text="还没有分类，先创建一个记忆星系">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="slug" label="Slug" min-width="140" />
        <el-table-column prop="description" label="描述" min-width="220">
          <template #default="{ row }">
            <span class="cell-muted">{{ row.description || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="photoCount" label="照片数" width="100" align="center">
          <template #default="{ row }">
            <span class="count-pill">{{ row.photoCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="90" align="center" />
        <el-table-column label="操作" width="160" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '新建分类'"
      width="min(480px, 92vw)"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent="save">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="64" placeholder="例如：毕业照" />
        </el-form-item>
        <el-form-item label="Slug" required>
          <el-input v-model="form.slug" maxlength="64" placeholder="例如：graduation" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="一句话描述这个记忆星系"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
      </el-form>

      <template #footer>
        <button type="button" class="mu-btn mu-btn--ghost mu-btn--sm" @click="dialogVisible = false">取消</button>
        <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" :disabled="submitting" @click="save">
          {{ submitting ? '保存中…' : '保存' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  updateCategory,
  type CategoryPayload
} from '@/api/admin'
import type { Category } from '@/types/domain'

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref('')
const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  sortOrder: 0
})

function resetForm() {
  form.name = ''
  form.slug = ''
  form.description = ''
  form.sortOrder = 0
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    categories.value = await fetchAdminCategories()
  } catch (cause) {
    error.value = (cause as Error).message
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(category: Category) {
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
  form.description = category.description ?? ''
  form.sortOrder = category.sortOrder
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim() || !form.slug.trim()) {
    ElMessage.warning('名称与 slug 不能为空')
    return
  }

  const payload: CategoryPayload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    sortOrder: form.sortOrder
  }

  submitting.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, payload)
      ElMessage.success('分类已更新')
    } else {
      await createCategory(payload)
      ElMessage.success('分类已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  } finally {
    submitting.value = false
  }
}

async function remove(category: Category) {
  try {
    await ElMessageBox.confirm(
      `确定删除分类「${category.name}」吗？分类下仍有照片时后端会拒绝删除。`,
      '删除分类',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await deleteCategory(category.id)
    ElMessage.success('分类已删除')
    await load()
  } catch (cause) {
    ElMessage.error((cause as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.category-manage {
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
  max-width: 42rem;
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.8;
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
  overflow-x: auto;
}

.cell-muted {
  color: var(--mu-muted);
}

.count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  padding: 0.14rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.68rem;
  color: #7dd3fc;
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
