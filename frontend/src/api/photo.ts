import http from './http'
import type { ApiResponse, PageResult, Photo, PhotoQuery } from '@/types/domain'

export async function fetchPhotos(query: PhotoQuery = {}): Promise<PageResult<Photo>> {
  const { data } = await http.get<ApiResponse<PageResult<Photo>>>('/api/public/photos', {
    params: query
  })
  return data.data
}

export async function fetchPhoto(id: number): Promise<Photo> {
  const { data } = await http.get<ApiResponse<Photo>>(`/api/public/photos/${id}`)
  return data.data
}

export async function fetchRandomPhoto(): Promise<Photo> {
  const { data } = await http.get<ApiResponse<Photo>>('/api/public/photos/random')
  return data.data
}
