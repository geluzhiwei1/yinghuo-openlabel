/**
 * 体数据编辑器全局状态(模块级 reactive 单例, 遵循 src/states 约定)。
 */
import { reactive } from 'vue'
import type { MedicalVolume } from './data/volumeModel'
import { CT_WL_PRESETS, defaultWl } from './data/presets'
import type { VrtMode } from './render/vrtMaterial'

export type ToolId = 'none' | 'brush' | 'sphereBrush' | 'eraser' | 'thresholdPaint' | 'contour' | 'magicWand' | 'growCut'
export type LayoutMode = 'grid' | 'axial' | 'coronal' | 'sagittal' | 'vrt'

/** 笔刷半径上限(体素) */
export const BRUSH_MAX = 200
/** 依赖笔刷半径的工具(半径滑条 / Shift+滚轮调径) */
export const RADIUS_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(['brush', 'sphereBrush', 'eraser', 'thresholdPaint', 'growCut'])
/** 调整笔刷半径一步的增量(键盘/Shift+滚轮共用) */
export function stepBrushRadius(r: number, dir: 1 | -1): number {
  const step = r < 8 ? 1 : Math.max(1, Math.round(r * 0.15))
  return Math.max(1, Math.min(BRUSH_MAX, r + dir * step))
}

export const volState = reactive({
    loading: false,
    loadProgress: 0,
    loadStage: '',

    base: null as MedicalVolume | null,      // 主体积(CT/单模态)
    overlay: null as MedicalVolume | null,   // PET(融合模式, 已重采样到 base 网格)
    fusionMode: false,
    petOn: true,                              // PET 叠加显示开关(2D 切片 + 3D 融合同步)

    crosshair: { i: 0, j: 0, k: 0 },         // 体素交叉线(全局同步)

    wl: { width: 400, level: 40 },
    wlPresetKey: 'soft',
    petWl: { width: 1, level: 0 },
    petLut: 'hot',
    petAlpha: 0.65,
    labelAlpha: 0.4,

    layoutMode: 'grid' as LayoutMode,
    activeTool: 'none' as ToolId,
    brushRadius: 8,                           // 体素(上限 BRUSH_MAX)
    eraserScope: 'active' as 'active' | 'all', // 橡皮只擦激活段 / 擦全部
    thresholdRange: { lo: 0, hi: 0 },
    wandCriterion: 'tolerance' as 'tolerance' | 'threshold', // 魔法棒: 种子±容差 / 阈值区间
    wandTolerance: 80,
    wandScope: 'slice' as 'slice' | 'volume',     // 魔法棒: 当前层 / 整体
    contourSnap: false,                           // 轮廓布点模式: Live Wire 吸附边缘
    growSeed: 'fg' as 'fg' | 'bg',                // GrowCut: 当前涂的是前景/背景种子

    vrt: {
        mode: 'vrt' as VrtMode,               // mip | vrt | fused | petMip
        tfPreset: '骨骼 CT-VRT',
        steps: 400,
        quality: 1,                            // 交互中自动降 0.5
    },

    dirty: false,                             // 有未保存标注
    savedAt: 0,
})

export function initVolumeState(base: MedicalVolume, overlay: MedicalVolume | null) {
    volState.base = base
    volState.overlay = overlay
    volState.fusionMode = !!overlay
    volState.petOn = !!overlay
    const [nx, ny, nz] = base.grid.dims
    volState.crosshair = { i: nx >> 1, j: ny >> 1, k: nz >> 1 }
    volState.wl = defaultWl('ct', base.intensity.min, base.intensity.max)
    volState.wlPresetKey = 'soft'
    if (overlay) {
        volState.petWl = defaultWl('pet', overlay.intensity.min, overlay.intensity.max)
    }
    volState.dirty = false
}

export const wlPresets = CT_WL_PRESETS

/** 实际生效的 3D 模式: overlay 缺失或 PET 关闭时 fused/petMip 回退渲染 vrt */
export function effectiveVrtMode(): VrtMode {
    return volState.overlay && volState.petOn ? volState.vrt.mode
        : (volState.vrt.mode === 'fused' || volState.vrt.mode === 'petMip' ? 'vrt' : volState.vrt.mode)
}

export const sliceCount = (axis: 0 | 1 | 2): number => {
    const b = volState.base
    return b ? b.grid.dims[axis] : 0
}

export const crosshairSlice = (axis: 0 | 1 | 2): number => {
    const c = volState.crosshair
    return axis === 0 ? c.i : axis === 1 ? c.j : c.k
}

export function setCrosshairSlice(axis: 0 | 1 | 2, value: number) {
    const dims = volState.base?.grid.dims
    if (!dims) return
    const v = Math.max(0, Math.min(dims[axis] - 1, Math.round(value)))
    if (axis === 0) volState.crosshair.i = v
    else if (axis === 1) volState.crosshair.j = v
    else volState.crosshair.k = v
}
