export type PhotoLayoutMode = 'galaxy' | 'spiral' | 'timeline'

/**
 * 引擎侧照片数据：只包含 3D 空间与详情面板需要的字段。
 * 结构兼容后端 Photo DTO，由 Vue 层直接传入。
 */
export interface PhotoWallItem {
  id: number
  title: string
  thumbnailUrl: string
  originalUrl: string
  description?: string | null
  categoryName?: string | null
  takenAt?: string | null
  location?: string | null
}

export interface PhotoPlacement {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}
