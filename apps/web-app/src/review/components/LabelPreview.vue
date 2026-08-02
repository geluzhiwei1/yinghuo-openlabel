<template>
  <div class="label-preview">
    <div class="preview-toolbar">
      <span class="title">
        Unit
        <code>#{{ unitId ?? '—' }}</code>
      </span>
      <span v-if="mission" class="mission">
        <el-tag size="small" effect="plain">{{ mission }}</el-tag>
      </span>
      <span v-if="versionLabel" class="version">
        <el-tag size="small" type="info">{{ versionLabel }}</el-tag>
      </span>
      <div class="spacer"></div>
      <span class="hint" v-if="objects.length > 0">
        {{ objects.length }} 个对象
      </span>
    </div>

    <div class="canvas-wrap" v-loading="loading">
      <div v-if="!unitId" class="placeholder">
        <el-empty :image-size="120" description="从左侧选择 Unit" />
      </div>
      <div v-else-if="!hasLabel" class="placeholder">
        <el-empty :image-size="120" description="该 Unit 暂无标注数据" />
      </div>
      <div v-else class="canvas-stage" :style="{ width: stageW + 'px', height: stageH + 'px' }">
        <div class="grid-bg"></div>
        <div
          v-for="(b, i) in bboxList"
          :key="b.id ?? i"
          class="bbox"
          :style="bboxStyle(b)"
        >
          <span class="bbox-label">{{ b.label ?? b.id ?? i }}</span>
        </div>
        <div v-if="bboxList.length === 0" class="no-bbox-hint">
          <el-tag size="small" type="info" effect="plain">
            无 2D bbox 对象,请查看右侧对象列表
          </el-tag>
        </div>
      </div>
    </div>

    <div class="object-list" v-if="objects.length > 0">
      <div class="list-title">对象明细</div>
      <div class="list-body">
        <div v-for="(obj, i) in objects" :key="(obj.id ?? i)" class="object-item">
          <span class="obj-id">{{ obj.id ?? `#${i}` }}</span>
          <span class="obj-name">{{ obj.name ?? obj.label ?? '—' }}</span>
          <span class="obj-coords">{{ formatCoords(obj) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UnitLabel } from '@/types/api'

const props = defineProps<{
  unitId?: number | null
  label: UnitLabel | null
  loading?: boolean
}>()

const STAGE_W = 960
const STAGE_H = 540
const stageW = STAGE_W
const stageH = STAGE_H

const mission = computed(() => props.label?.mission)
const objects = computed<any[]>(() => props.label?.objects ?? [])
const hasLabel = computed(() => props.label != null && objects.value.length >= 0)
const versionLabel = computed(() =>
  props.label ? `v${props.label.version}` : '',
)

interface BBox {
  id?: string
  label?: string
  x: number
  y: number
  w: number
  h: number
}

// 兼容多种 shape:对象里可能有 object_data.bbox2d.val=[x1,y1,x2,y2],
// 或顶层 bbox2d = [x1,y1,x2,y2],或 bbox = {x,y,w,h}
const extractBBox = (obj: any): BBox | null => {
  const od = obj.object_data ?? obj
  const b2d = od.bbox2d ?? od.bbox
  if (Array.isArray(b2d) && b2d.length >= 4) {
    const [x1, y1, x2, y2] = b2d
    return {
      id: obj.id,
      label: obj.name ?? obj.label ?? od.name,
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
    }
  }
  if (b2d && typeof b2d === 'object') {
    const val = b2d.val
    if (Array.isArray(val) && val.length >= 4) {
      const [x1, y1, x2, y2] = val
      return {
        id: obj.id,
        label: obj.name ?? obj.label,
        x: x1,
        y: y1,
        w: x2 - x1,
        h: y2 - y1,
      }
    }
    if (typeof b2d.x === 'number') {
      return {
        id: obj.id,
        label: obj.name ?? obj.label,
        x: b2d.x,
        y: b2d.y,
        w: b2d.w ?? b2d.width,
        h: b2d.h ?? b2d.height,
      }
    }
  }
  return null
}

const bboxList = computed<BBox[]>(() =>
  objects.value.map(extractBBox).filter((b): b is BBox => b != null),
)

const bboxStyle = (b: BBox) => {
  // bbox 坐标假定在原画布(常见 1920x1080),按比例缩放到预览舞台
  const scale = Math.min(STAGE_W / 1920, STAGE_H / 1080)
  const w = Math.max(8, b.w * scale)
  const h = Math.max(8, b.h * scale)
  return {
    left: `${b.x * scale}px`,
    top: `${b.y * scale}px`,
    width: `${w}px`,
    height: `${h}px`,
  }
}

const formatCoords = (obj: any): string => {
  const b = extractBBox(obj)
  if (!b) return JSON.stringify(obj).slice(0, 60)
  return `(${Math.round(b.x)},${Math.round(b.y)}) ${Math.round(b.w)}×${Math.round(b.h)}`
}
</script>

<style scoped>
.label-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
}
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}
.preview-toolbar .title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-toolbar code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--el-fill-color);
  padding: 1px 6px;
  border-radius: 3px;
}
.spacer {
  flex: 1;
}
.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.canvas-wrap {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--el-fill-color-darker);
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.canvas-stage {
  position: relative;
  background: #2c2c2c;
  border: 1px solid var(--el-border-color);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
.grid-bg {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 60px 60px;
}
.bbox {
  position: absolute;
  border: 2px solid var(--el-color-primary);
  background: rgba(64, 158, 255, 0.1);
  box-sizing: border-box;
}
.bbox-label {
  position: absolute;
  top: -18px;
  left: -2px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 2px;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.no-bbox-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.object-list {
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  max-height: 200px;
  display: flex;
  flex-direction: column;
}
.list-title {
  font-size: 12px;
  font-weight: 600;
  padding: 8px 16px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.list-body {
  overflow-y: auto;
  flex: 1;
}
.object-item {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 12px;
  padding: 6px 16px;
  font-size: 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.obj-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--el-text-color-secondary);
}
.obj-name {
  color: var(--el-text-color-regular);
}
.obj-coords {
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
