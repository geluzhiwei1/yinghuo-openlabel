import { pySeqData } from '@/pointcloud/api'

// Rust wasm 支持的 colormap 名 —— 与 www.geluzhiwei.com/rust-wasm/src/colormap.rs 对齐。
// 不在此列表里的 colormap 仍走后端 pySeqData.PcUtils.calc_color,保证视觉与 matplotlib 一致。
const WASM_SUPPORTED_COLORMAPS = new Set<string>([
    'jet', 'hsv', 'gray', 'grey', 'hot', 'cool',
])

type RustHelper = {
    pc_calc_color?: (arr: Float32Array, lo: number, hi: number, name: string) => number[] | Float32Array
}

function getRustHelper(): RustHelper | null {
    if (typeof window === 'undefined') return null
    return (window as unknown as { labelHelper?: RustHelper }).labelHelper ?? null
}

/**
 * 计算点云 colormap。
 *
 * 优先走 Rust wasm(`window.labelHelper.pc_calc_color`)—— 比后端往返快数十倍,
 * 尤其是拖动 colormap 范围滑块时。若 wasm 未加载、colormap 不在白名单、或调用
 * 抛错,自动回退到 Python 后端 `pySeqData.PcUtils.calc_color`。
 *
 * @returns 长度 = 3*N 的 f32 数组,每三个一组表示一个点的 RGB,取值 [0,1]。
 */
export async function calcPointCloudColor(
    arr: ArrayLike<number>,
    rangeMin: number,
    rangeMax: number,
    colorMap: string,
): Promise<number[]> {
    const helper = getRustHelper()
    if (helper?.pc_calc_color && WASM_SUPPORTED_COLORMAPS.has(colorMap)) {
        try {
            const f32 = arr instanceof Float32Array ? arr : Float32Array.from(arr)
            const out = helper.pc_calc_color(f32, rangeMin, rangeMax, colorMap)
            return Array.from(out)
        } catch (err) {
            console.warn('[wasm colormap] pc_calc_color failed, fallback to backend:', err)
        }
    }

    const res = await pySeqData.PcUtils.calc_color({
        arr: Array.from(arr),
        range_min: rangeMin,
        range_max: rangeMax,
        color_map_name: colorMap,
    })
    return res.data
}
