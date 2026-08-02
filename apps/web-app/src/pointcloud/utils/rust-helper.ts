/**
 * Rust wasm 辅助层:为 pointcloud 模块的 4 个 parser + select + aabb 提供类型化访问。
 *
 * 模式参照 colormap.ts:13-51 — 优先调 wasm,失败回退到上层 JS 路径(由调用方处理)。
 * window.labelHelper 由 libs/plugin.ts:loadRustWasm 注入,fetch 自 /webapps/rust_wasm/。
 */

export type PcdFormat = 0 | 1 | 2  // binary / binary_compressed / ascii

export type ParsedPointcloud = {
  position: Float32Array
  color: Float32Array | null
  intensity: Float32Array | null
  normal: Float32Array | null
  label: Int32Array | null
  header: Record<string, unknown>
}

export type RustHelper = {
  // colormap(已存在)
  pc_calc_color?: (
    arr: Float32Array, lo: number, hi: number, name: string
  ) => number[] | Float32Array

  // PCD parser
  pc_parse_pcd?: (
    data: Uint8Array,
    headerLen: number,
    points: number,
    rowSize: number,
    fields: string,
    sizes: string,
    offsets: string,
    types: string,
    format: PcdFormat,
    littleEndian: boolean,
  ) => ParsedPointcloud | null

  // PLY parser
  pc_parse_ply?: (data: Uint8Array) => ParsedPointcloud | null

  // LAS parser
  pc_parse_las?: (data: Uint8Array) => ParsedPointcloud | null

  // LAZ parser(走 las crate 的 laz feature,实现上和 pc_parse_las 同入口)
  pc_parse_laz?: (data: Uint8Array) => ParsedPointcloud | null

  // 框选热路径
  pc_select_points_in_polygon?: (
    positions: Float32Array,
    matrixWorld: Float32Array,
    viewProjMatrix: Float32Array,
    viewW: number,
    viewH: number,
    polygon: Float32Array,
  ) => Uint32Array | null

  // AABB 计算
  pc_compute_aabb?: (
    positions: Float32Array,
    indices: Uint32Array,
  ) => Float32Array | null
}

/**
 * 拿到已加载的 rust helper。wasm 未加载或不在浏览器环境时返回 null,
 * 由调用方走原 JS fallback。
 */
export function getRustHelper(): RustHelper | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { labelHelper?: RustHelper }).labelHelper ?? null
}
