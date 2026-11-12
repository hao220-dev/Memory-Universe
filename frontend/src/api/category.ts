import http from './http'
import type { ApiResponse, Category } from '@/types/domain'

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await http.get<ApiResponse<Category[]>>('/api/public/categories')
  return data.data
}
