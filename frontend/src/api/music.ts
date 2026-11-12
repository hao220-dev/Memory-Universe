import http from './http'
import type { ApiResponse, Music } from '@/types/domain'

export async function fetchPublicMusic(): Promise<Music[]> {
  const { data } = await http.get<ApiResponse<Music[]>>('/api/public/music')
  return data.data
}

export async function fetchAdminMusic(): Promise<Music[]> {
  const { data } = await http.get<ApiResponse<Music[]>>('/api/admin/music')
  return data.data
}

export interface MusicUploadPayload {
  file?: File
  url?: string
  title?: string
  artist?: string
  sortOrder?: number
}

export async function uploadMusic(payload: MusicUploadPayload): Promise<Music> {
  const form = new FormData()
  if (payload.file) {
    form.append('file', payload.file)
  }
  if (payload.url) {
    form.append('url', payload.url)
  }
  if (payload.title) {
    form.append('title', payload.title)
  }
  if (payload.artist) {
    form.append('artist', payload.artist)
  }
  if (payload.sortOrder != null) {
    form.append('sortOrder', String(payload.sortOrder))
  }
  const { data } = await http.post<ApiResponse<Music>>('/api/admin/music', form)
  return data.data
}

export interface MusicUpdatePayload {
  title?: string
  artist?: string
  sortOrder?: number
  enabled?: boolean
}

export async function updateMusic(id: number, payload: MusicUpdatePayload): Promise<Music> {
  const { data } = await http.put<ApiResponse<Music>>(`/api/admin/music/${id}`, payload)
  return data.data
}

export async function deleteMusic(id: number): Promise<void> {
  await http.delete<ApiResponse<void>>(`/api/admin/music/${id}`)
}
