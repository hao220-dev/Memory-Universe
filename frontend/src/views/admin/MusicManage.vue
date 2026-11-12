<template>
  <div class="music-manage">
    <header class="manage-head glass-panel">
      <div>
        <p class="eyebrow">Ambient Sound</p>
        <h2>音乐管理</h2>
        <p class="manage-desc">
          上传自定义背景音乐，支持 MP3 / WAV / OGG / M4A / AAC / FLAC / OPUS，单个文件不超过 20MB。
          启用后的曲目会按排序在前台环境音乐中播放。
        </p>
      </div>
      <button type="button" class="mu-btn mu-btn--primary mu-btn--sm" @click="openUpload">上传音乐</button>
    </header>

    <p v-if="error" class="manage-error">{{ error }}</p>

    <div class="table-panel glass-panel">
      <el-table
        v-loading="loading"
        :data="tracks"
        style="width: 100%"
        empty-text="还没有背景音乐，点击右上角上传"
      >
        <el-table-column prop="title" label="曲目" min-width="170">
          <template #default="{ row }">
            <div class="cell-title">{{ row.title }}</div>
            <div class="cell-muted">{{ row.artist || '未知歌手' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="试听" width="250">
          <template #default="{ row }">
            <audio :src="row.url" controls preload="none" class="audio-preview"></audio>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="120">
          <template #default="{ row }">
            <el-input-number
              v-model="row.sortOrder"
              :min="0"
              size="small"
              controls-position="right"
              @change="(value: number | undefined) => changeSort(row, value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(value: boolean) => toggleEnabled(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="上传背景音乐" width="520px" :close-on-click-modal="false">
      <div class="upload-form">
        <label class="form-row">
          <span>音频文件</span>
          <input
            ref="fileInputRef"
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,audio/*"
            @change="handleFileChange"
          />
        </label>
        <p class="form-hint">
          支持 MP3 / WAV / OGG / M4A / AAC / FLAC / OPUS，最大 20MB。不选文件时也可以填写外部音频地址。
        </p>
        <label class="form-row">
          <span>音频地址</span>
          <el-input v-model="form.url" placeholder="https://...（可选）" clearable />
        </label>
        <label class="form-row">
          <span>曲目名称</span>
          <el-input v-model="form.title" placeholder="默认使用文件名" maxlength="120" />
        </label>
        <label class="form-row">
          <span>歌手</span>
          <el-input v-model="form.artist" placeholder="可选" maxlength="120" />
        </label>
        <label class="form-row">
          <span>排序</span>
          <el-input-number v-model="form.sortOrder" :min="0" controls-position="right" />
        </label>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteMusic, fetchAdminMusic, updateMusic, uploadMusic } from '@/api/music'
import type { Music } from '@/types/domain'

const MAX_SIZE = 20 * 1024 * 1024

const tracks = ref<Music[]>([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const error = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const form = reactive({ url: '', title: '', artist: '', sortOrder: 0 })

async function load() {
  loading.value = true
  error.value = ''
  try {
    tracks.value = await fetchAdminMusic()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function openUpload() {
  form.url = ''
  form.title = ''
  form.artist = ''
  form.sortOrder = tracks.value.length
  selectedFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  dialogVisible.value = true
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (file && file.size > MAX_SIZE) {
    ElMessage.error('音频文件不能超过 20MB')
    input.value = ''
    selectedFile.value = null
    return
  }
  selectedFile.value = file
  if (file && !form.title) {
    form.title = file.name.replace(/\.[^.]+$/, '')
  }
}

async function submit() {
  if (!selectedFile.value && !form.url.trim()) {
    ElMessage.warning('请选择音频文件或填写音频地址')
    return
  }
  submitting.value = true
  try {
    const created = await uploadMusic({
      file: selectedFile.value ?? undefined,
      url: form.url.trim() || undefined,
      title: form.title.trim() || undefined,
      artist: form.artist.trim() || undefined,
      sortOrder: form.sortOrder
    })
    tracks.value.push(created)
    dialogVisible.value = false
    ElMessage.success('音乐已上传')
  } catch (err) {
    ElMessage.error((err as Error).message)
  } finally {
    submitting.value = false
  }
}

async function toggleEnabled(row: Music, value: boolean) {
  const previous = row.enabled
  row.enabled = value
  try {
    await updateMusic(row.id, { enabled: value })
  } catch (err) {
    row.enabled = previous
    ElMessage.error((err as Error).message)
  }
}

async function changeSort(row: Music, value: number | undefined) {
  if (value == null) {
    return
  }
  try {
    await updateMusic(row.id, { sortOrder: value })
  } catch (err) {
    ElMessage.error((err as Error).message)
    await load()
  }
}

async function remove(row: Music) {
  try {
    await ElMessageBox.confirm(`确定删除《${row.title}》吗？`, '删除音乐', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await deleteMusic(row.id)
    tracks.value = tracks.value.filter((item) => item.id !== row.id)
    ElMessage.success('已删除')
  } catch (err) {
    ElMessage.error((err as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.music-manage {
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

.cell-title {
  font-weight: 500;
  color: var(--mu-star);
}

.cell-muted {
  font-size: 0.72rem;
  color: var(--mu-muted);
}

.audio-preview {
  width: 100%;
  height: 32px;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.form-row > span {
  flex: 0 0 5rem;
  font-size: 0.76rem;
  color: var(--mu-muted);
}

.form-row input[type='file'] {
  flex: 1;
  font-size: 0.74rem;
  color: var(--mu-muted);
}

.form-hint {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.7;
  color: rgba(148, 163, 184, 0.8);
}

@media (max-width: 720px) {
  .form-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.4rem;
  }

  .form-row > span {
    flex: none;
  }
}
</style>
