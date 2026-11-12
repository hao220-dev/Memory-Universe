import http from './http'
import type { ApiResponse, Category, PageResult, Photo } from '@/types/domain'

export interface AdminPhotoQuery {
  page?: number
  size?: number
  categoryId?: number
  keyword?: string
}

export interface PhotoUpdatePayload {
  title?: string
  description?: string | null
  categoryId?: number | null
  takenAt?: string | null
  location?: string | null
  sortOrder?: number
  visible?: boolean
}

export interface PhotoUploadMeta {
  categoryId?: number
  title?: string
  description?: string
  takenAt?: string
  location?: string
}

export interface CategoryPayload {
  name?: string
  slug?: string
  description?: string | null
  sortOrder?: number
}

export async function fetchAdminPhotos(query: AdminPhotoQuery = {}): Promise<PageResult<Photo>> {
  const { data } = await http.get<ApiResponse<PageResult<Photo>>>('/api/admin/photos', {
    params: query
  })
  return data.data
}

export async function uploadPhotos(files: File[], meta: PhotoUploadMeta = {}): Promise<Photo[]> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  if (meta.categoryId != null) form.append('categoryId', String(meta.categoryId))
  if (meta.title) form.append('title', meta.title)
  if (meta.description) form.append('description', meta.description)
  if (meta.takenAt) form.append('takenAt', meta.takenAt)
  if (meta.location) form.append('location', meta.location)

  const { data } = await http.post<ApiResponse<Photo[]>>('/api/admin/photos/batch', form, {
    timeout: 120000
  })
  return data.data
}

export async function updatePhoto(id: number, payload: PhotoUpdatePayload): Promise<Photo> {
  const { data } = await http.put<ApiResponse<Photo>>(`/api/admin/photos/${id}`, payload)
  return data.data
}

export async function deletePhoto(id: number): Promise<void> {
  await http.delete<ApiResponse<null>>(`/api/admin/photos/${id}`)
}

export async function fetchAdminCategories(): Promise<Category[]> {
  const { data } = await http.get<ApiResponse<Category[]>>('/api/admin/categories')
  return data.data
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const { data } = await http.post<ApiResponse<Category>>('/api/admin/categories', payload)
  return data.data
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<Category> {
  const { data } = await http.put<ApiResponse<Category>>(`/api/admin/categories/${id}`, payload)
  return data.data
}

export async function deleteCategory(id: number): Promise<void> {
  await http.delete<ApiResponse<null>>(`/api/admin/categories/${id}`)
}
