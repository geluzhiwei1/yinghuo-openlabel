import { reactive } from 'vue'
import type * as THREE from 'three'
import type { SplatArray } from './render/loaders'

export type SelectionMode = 'off' | 'click' | 'box' | 'brush'
export type BrushOp = 'add' | 'remove'

/** Tint applied to currently-picked splats (coral — same hue as the design system's "action" accent). */
export const SELECTION_COLOR = '#ff6a3d'

/** Default palette for new labels — stays within the lab pastel accents. */
export const LABEL_PALETTE = [
  '#c8fa4b', // lime
  '#b6dcff', // sky
  '#d9ccff', // lilac
  '#b8f0d0', // mint
  '#ffe58a', // butter
  '#ff6a3d', // coral
  '#f7a8c5', // pink-soft
  '#9ad3ff', // ice
]

export interface SplatLabel {
  id: string
  name: string
  /** hex color, e.g. "#c8fa4b" */
  color: string
  /** indices into the splat array */
  indices: number[]
}

export interface GaussianState {
  loaded: boolean
  fileName: string
  format: 'ply' | 'splat' | 'spz' | ''
  /**
   * True when a .ply file was parsed via the point-cloud fallback (no
   * `f_dc_*` properties) rather than as native 3DGS splats. Surfaced in the
   * UI so the user understands the splat parameters are synthetic.
   */
  isPointCloud: boolean
  splats: SplatArray | null
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
  count: number
  /** hidden splat indices — effectively "deleted" in this session */
  hidden: Set<number>
  /** currently selected splat indices (transient, before assignment to a label) */
  selection: Set<number>
  /** active interaction mode */
  selectionMode: SelectionMode
  /** brush radius in CSS pixels */
  brushRadiusPx: number
  /** current brush operation — add to selection/label, or remove from it */
  brushOp: BrushOp
  /**
   * When true, brush strokes write directly into the active label instead of
   * the transient selection. Lets the user paint a label across many regions
   * without the select→assign dance per region.
   */
  brushAutoAssign: boolean
  /** defined labels */
  labels: SplatLabel[]
  /** active label id — newly assigned splats get this label */
  currentLabelId: string | null
  /** when true, render labeled splats with their label color instead of natural splat color */
  showLabelColors: boolean
  /** render params */
  pointSize: number
  density: number
  sceneColor: string
  lastError: string
  loading: boolean
}

export const gaussianState = reactive<GaussianState>({
  loaded: false,
  fileName: '',
  format: '',
  isPointCloud: false,
  splats: null,
  bounds: null,
  count: 0,
  hidden: new Set<number>(),
  selection: new Set<number>(),
  selectionMode: 'off',
  brushRadiusPx: 32,
  brushOp: 'add',
  brushAutoAssign: false,
  labels: [],
  currentLabelId: null,
  showLabelColors: true,
  pointSize: 1.0,
  density: 1.0,
  sceneColor: '#0e0e10',
  lastError: '',
  loading: false,
})

export const resetGaussianState = () => {
  gaussianState.loaded = false
  gaussianState.fileName = ''
  gaussianState.format = ''
  gaussianState.isPointCloud = false
  gaussianState.splats = null
  gaussianState.bounds = null
  gaussianState.count = 0
  gaussianState.hidden.clear()
  gaussianState.selection.clear()
  gaussianState.selectionMode = 'off'
  gaussianState.brushRadiusPx = 32
  gaussianState.brushOp = 'add'
  gaussianState.brushAutoAssign = false
  gaussianState.labels = []
  gaussianState.currentLabelId = null
  gaussianState.lastError = ''
}

export type CameraFrame = { position: THREE.Vector3; target: THREE.Vector3 }
