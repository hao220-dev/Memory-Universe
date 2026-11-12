import * as THREE from 'three'
import type { PhotoLayoutMode, PhotoPlacement, PhotoWallItem } from './types'

const CENTER = new THREE.Vector3(0, 0, -18)
const TIMELINE_VIEW = new THREE.Vector3(0, 5, 42)
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const helper = new THREE.Object3D()

/** 稳定的伪随机，保证重新布局时照片位置不会乱跳。 */
function seeded(index: number, salt = 0): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

function faceOutward(position: THREE.Vector3): THREE.Quaternion {
  helper.position.copy(position)
  const outward = position.clone().sub(CENTER)
  helper.lookAt(position.clone().add(outward))
  helper.rotateZ((seeded(position.x + position.y) - 0.5) * 0.24)
  return helper.quaternion.clone()
}

function toPlacement(position: THREE.Vector3, quaternion: THREE.Quaternion): PhotoPlacement {
  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
  }
}

function galaxyLayout(items: PhotoWallItem[]): PhotoPlacement[] {
  const count = Math.max(items.length, 1)
  return items.map((_, index) => {
    const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2
    const ringRadius = Math.sqrt(Math.max(1 - y * y, 0))
    const theta = GOLDEN_ANGLE * index + seeded(index, 2) * 0.16
    const radius = 14 + seeded(index, 1) * 10 + (index % 3) * 1.2

    const position = new THREE.Vector3(
      Math.cos(theta) * ringRadius,
      y * 0.66 + (seeded(index, 5) - 0.5) * 1.4,
      Math.sin(theta) * ringRadius
    )
      .multiplyScalar(radius)
      .add(CENTER)

    return toPlacement(position, faceOutward(position))
  })
}

function spiralLayout(items: PhotoWallItem[]): PhotoPlacement[] {
  const count = Math.max(items.length, 1)
  const arms = 3
  return items.map((_, index) => {
    const progress = count === 1 ? 0.5 : index / (count - 1)
    const arm = index % arms
    const theta = (arm / arms) * Math.PI * 2 + progress * Math.PI * 3.2
    const radius = 11 + progress * 17 + (seeded(index, 7) - 0.5) * 1.6
    const position = new THREE.Vector3(
      Math.cos(theta) * radius,
      (progress - 0.5) * 11 + (seeded(index, 3) - 0.5) * 2.2,
      Math.sin(theta) * radius * 0.86
    ).add(CENTER)

    return toPlacement(position, faceOutward(position))
  })
}

function timelineLayout(items: PhotoWallItem[]): PhotoPlacement[] {
  const count = Math.max(items.length, 1)
  const order = items
    .map((item, index) => ({ index, date: item.takenAt ?? '' }))
    .sort((a, b) => (a.date === b.date ? a.index - b.index : a.date.localeCompare(b.date)))

  const placements: PhotoPlacement[] = new Array(items.length)
  order.forEach((entry, rank) => {
    const progress = count === 1 ? 0.5 : rank / (count - 1)
    const position = new THREE.Vector3(
      (progress - 0.5) * 40,
      Math.sin(progress * Math.PI * 2) * 2.4 + (progress - 0.5) * 4.5,
      CENTER.z + 11 - Math.cos(progress * Math.PI) * 5.5
    )

    helper.position.copy(position)
    helper.lookAt(TIMELINE_VIEW)
    helper.rotateZ((seeded(rank, 11) - 0.5) * 0.14)
    helper.rotateY((seeded(rank, 13) - 0.5) * 0.18)
    placements[entry.index] = toPlacement(position, helper.quaternion.clone())
  })

  return placements
}

/** 根据布局模式计算每张照片的世界坐标与朝向。 */
export function computePhotoLayout(
  items: PhotoWallItem[],
  mode: PhotoLayoutMode
): PhotoPlacement[] {
  if (mode === 'spiral') {
    return spiralLayout(items)
  }
  if (mode === 'timeline') {
    return timelineLayout(items)
  }
  return galaxyLayout(items)
}
