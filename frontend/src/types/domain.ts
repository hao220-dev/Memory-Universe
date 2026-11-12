export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export interface UserSummary {
  id: number
  username: string
  nickname: string
  role: string
}

export interface LoginResponse {
  token: string
  tokenType: string
  expiresIn: number
  user: UserSummary
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string | null
  sortOrder: number
  photoCount: number
}

export interface Photo {
  id: number
  title: string
  description?: string | null
  categoryId?: number | null
  categoryName?: string | null
  originalUrl: string
  thumbnailUrl: string
  takenAt?: string | null
  location?: string | null
  sortOrder: number
  visible: boolean
  fileSize: number
  createdAt: string
}

export interface PhotoQuery {
  page?: number
  size?: number
  categoryId?: number
  year?: number
  keyword?: string
}

export interface Music {
  id: number
  title: string
  artist?: string | null
  url: string
  coverUrl?: string | null
  duration?: number | null
  sortOrder: number
  enabled: boolean
  createdAt: string
}
