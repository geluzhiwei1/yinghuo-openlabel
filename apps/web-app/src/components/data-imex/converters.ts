/**
 * 标签导入格式转换层
 *
 * 把 YOLO / COCO / OpenLabel 三种输入统一转换成前端画布使用的 OpenLabel BBox 数组,
 * 再交给 mainAnnoater.import('default', annos) 加载到画布。
 *
 * 输出 shape 与 video/annotaters/bboxBuilder.ts 中新建 BBox 的结构一致。
 */

import { v4 as uuidv4 } from 'uuid'
import { OlTypeEnum, type BBox } from '@/openlabel'

/** 通用 OpenLabel BBox 工厂 */
export function makeBBox(objectType: string, cx: number, cy: number, w: number, h: number): BBox {
  return {
    geometryId: '',
    label_uuid: uuidv4(),
    ol_type_: OlTypeEnum.BBox,
    object_id: undefined,
    object_type: objectType || 'default',
    object_uuid: uuidv4(),
    objectAttributes: {},
    val: [cx, cy, w, h],
    attributes: {},
  } as unknown as BBox
}

export interface CocoData {
  images?: Array<{ id: number; width?: number; height?: number; file_name?: string }>
  annotations?: Array<{
    id?: number
    image_id: number
    category_id: number
    bbox?: [number, number, number, number]
    segmentation?: any
    attributes?: Record<string, any>
    iscrowd?: number
  }>
  categories?: Array<{ id: number; name: string; supercategory?: string }>
}

/**
 * 把 COCO 格式数据转换成 OpenLabel BBox 数组。
 *
 * COCO 的 bbox 是 [x, y, w, h] (左上角 + 宽高,绝对像素),
 * OpenLabel 的 BBox.val 是 [cx, cy, w, h] (中心点 + 宽高)。
 */
export function cocoToOpenLabel(coco: CocoData): BBox[] {
  if (!coco || typeof coco !== 'object') {
    throw new Error('COCO 数据为空或格式不正确')
  }
  const categories = coco.categories || []
  const annotations = coco.annotations || []
  if (annotations.length === 0) {
    return []
  }

  const idToName = new Map<number, string>()
  for (const cat of categories) {
    idToName.set(cat.id, cat.name)
  }

  const idToImage = new Map<number, { width?: number; height?: number; file_name?: string }>()
  for (const img of coco.images || []) {
    idToImage.set(img.id, img)
  }

  const out: BBox[] = []
  for (const anno of annotations) {
    if (!anno.bbox || anno.bbox.length !== 4) continue
    const [x, y, w, h] = anno.bbox
    if (!(w > 0) || !(h > 0)) continue
    const objectType = idToName.get(anno.category_id) || `class_${anno.category_id}`
    const cx = x + w / 2
    const cy = y + h / 2
    const bbox = makeBBox(objectType, cx, cy, w, h)
    if (anno.attributes && typeof anno.attributes === 'object') {
      bbox.attributes = { ...bbox.attributes, ...anno.attributes }
    }
    out.push(bbox)
  }
  return out
}

export interface YoloPayload {
  /** 类别名称列表,索引即 class_id。也接受 data.yaml 中的 names 段。 */
  classes?: string[] | Record<string, string>
  /** [width, height],缺省时调用方传入 fallback */
  image_shape?: [number, number]
  /** YOLO 标签文本,每行 `class_id cx cy w h` (归一化 0-1) */
  labels?: string
}

/**
 * 把 YOLO 文本标签转换成 OpenLabel BBox 数组。
 *
 * YOLO 每行: `class_id cx cy w h`,所有值都归一化到 [0,1] (相对图像宽高)。
 * 必须知道图像宽高才能转回绝对像素 —— 优先使用 payload.image_shape,
 * 否则使用 fallback (一般来自 globalStates.imageObject)。
 */
export function yoloToOpenLabel(
  payload: YoloPayload,
  fallbackWidth: number,
  fallbackHeight: number,
): BBox[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('YOLO 数据为空或格式不正确')
  }
  const labelsText: string = payload.labels || ''
  if (!labelsText.trim()) {
    return []
  }

  let classes: string[] = []
  if (Array.isArray(payload.classes)) {
    classes = payload.classes.map((s) => String(s))
  } else if (payload.classes && typeof payload.classes === 'object') {
    classes = Object.keys(payload.classes)
      .map((k) => Number(k))
      .sort((a, b) => a - b)
      .map((k) => String((payload.classes as Record<string, string>)[k]))
  }

  let width = fallbackWidth
  let height = fallbackHeight
  if (Array.isArray(payload.image_shape) && payload.image_shape.length === 2) {
    const [w, h] = payload.image_shape
    if (w && w > 0) width = Number(w)
    if (h && h > 0) height = Number(h)
  }
  if (!(width > 0) || !(height > 0)) {
    throw new Error('缺少图像尺寸,无法把 YOLO 归一化坐标还原为像素')
  }

  const out: BBox[] = []
  const lines = labelsText.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/).map((s) => Number(s))
    if (parts.length < 5 || parts.some((n) => Number.isNaN(n))) continue
    const [classId, ncx, ncy, nw, nh] = parts
    if (!(nw > 0) || !(nh > 0)) continue
    const objectType = classes[classId] || `class_${classId}`
    const cx = ncx * width
    const cy = ncy * height
    const w = nw * width
    const h = nh * height
    out.push(makeBBox(objectType, cx, cy, w, h))
  }
  return out
}

/** 从 YOLO 的 data.yaml 文本里解析出类别列表。
 *  支持两种写法:
 *    1) 纯名单,每行一个类名
 *    2) data.yaml 的 names 段: `names:\n  0: person\n  1: car` 或 `names: [person, car]`
 */
export function parseYoloClasses(text: string): string[] {
  if (!text) return []
  const yamlLike = text.trim()

  if (yamlLike.includes('names:')) {
    const idx = yamlLike.indexOf('names:')
    const rest = yamlLike.slice(idx + 'names:'.length)
    if (rest.trim().startsWith('[')) {
      const match = rest.match(/\[([^\]]*)\]/)
      if (match) {
        return match[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
      }
    }
    const lines = rest.split(/\r?\n/)
    const numbered: { i: number; name: string }[] = []
    const bare: string[] = []
    for (const line of lines) {
      const m = line.match(/^\s*-?\s*(\d+)\s*:\s*(.+)$/)
      if (m) {
        numbered.push({ i: Number(m[1]), name: m[2].trim().replace(/^['"]|['"]$/g, '') })
        continue
      }
      const m2 = line.match(/^\s*-\s+(.+)$/)
      if (m2) {
        bare.push(m2[1].trim().replace(/^['"]|['"]$/g, ''))
      }
    }
    if (numbered.length) {
      numbered.sort((a, b) => a.i - b.i)
      return numbered.map((x) => x.name)
    }
    if (bare.length) return bare
  }

  return yamlLike
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'))
}
