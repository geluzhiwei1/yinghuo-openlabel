/**
 * MPR 切片合成器: base(灰度 WL) → overlay(PET LUT, α 混合) → labelmap 着色。
 * 输出 ImageData; 支持脏 bbox 局部重合成(笔画中不整片重算)。8 张 LRU 缓存供滚层。
 * 笔画期间 labelVersion 不变 → 脏补丁直接改缓存条目; 结构性变化(undo/删段/可见性)
 * 由调用方 bumpLabelVersion() 使 key 失效走全量。
 */
import type { MedicalVolume, Axis } from '../data/volumeModel'

export interface SegmentStyle {
    color: number          // ABGR packed
    visible: boolean
}

export interface ComposeInput {
    base: MedicalVolume
    overlay?: MedicalVolume | null
    overlayLut?: Uint32Array | null
    overlayAlpha: number
    wl: { width: number; level: number }
    overlayWl: { width: number; level: number }
    labelmap?: Uint16Array | null
    segments: Map<number, SegmentStyle>
    labelAlpha: number
}

export interface SliceGeom {
    width: number
    height: number
}

export interface DirtyRect {
    x0: number; y0: number; x1: number; y1: number
}

/** 各轴切面的图像几何: 宽×高 + 方位字母(四角) */
export function sliceGeometry(axis: Axis, g: MedicalVolume['grid']): SliceGeom {
    const [nx, ny, nz] = g.dims
    if (axis === 2) return { width: nx, height: ny }       // axial: x=R-L, y=A-P
    if (axis === 1) return { width: nx, height: nz }       // coronal: x=R-L, y=S-I
    return { width: ny, height: nz }                        // sagittal: x=A-P, y=S-I
}

const alphaBlend = (dst: number, src: number, a: number): number => {
    // dst/src: ABGR packed; 常量 α 混合(保留 dst 的 alpha=255)
    const dr = dst & 0xff, dg = (dst >> 8) & 0xff, db = (dst >> 16) & 0xff
    const sr = src & 0xff, sg = (src >> 8) & 0xff, sb = (src >> 16) & 0xff
    const r = (dr + (sr - dr) * a) | 0
    const gg = (dg + (sg - dg) * a) | 0
    const b = (db + (sb - db) * a) | 0
    return 0xff000000 | (b << 16) | (gg << 8) | r
}

export class SliceCompositor {
    private cache = new Map<string, ImageData>()
    private labelVersion = 0

    private cacheKey(axis: Axis, index: number, input: ComposeInput): string {
        return [
            axis, index,
            input.wl.width | 0, input.wl.level | 0,
            input.overlay ? '1' : '0',
            input.overlay ? (input.overlayWl.width | 0) + ':' + (input.overlayWl.level | 0) : '',
            input.overlayLut ? input.overlayLut[1] : '',
            Math.round(input.overlayAlpha * 100),
            input.labelmap ? this.labelVersion : '0',
            Math.round(input.labelAlpha * 100),
        ].join('|')
    }

    bumpLabelVersion() { this.labelVersion++; this.cache.clear() }

    compose(axis: Axis, index: number, input: ComposeInput, dirty?: DirtyRect): ImageData {
        const key = this.cacheKey(axis, index, input)
        let img = this.cache.get(key)
        if (img) {
            this.cache.delete(key)
            this.cache.set(key, img)
        } else {
            const geom = sliceGeometry(axis, input.base.grid)
            img = new ImageData(geom.width, geom.height)
            this.composeRect(img, axis, index, input, 0, 0, geom.width - 1, geom.height - 1)
            this.cache.set(key, img)
            if (this.cache.size > 8) {
                const oldest = this.cache.keys().next().value
                this.cache.delete(oldest)
            }
        }
        if (dirty) {
            this.composeRect(img, axis, index, input, dirty.x0, dirty.y0, dirty.x1, dirty.y1)
        }
        return img
    }

    /** 图像坐标 (x 右增, y 下增) → 体素线性索引; 各轴行列约定见 sliceGeometry */
    private voxelIndexAt(axis: Axis, index: number, dims: [number, number, number], x: number, y: number): number {
        const [nx, ny, nz] = dims
        if (axis === 2) return index * nx * ny + (ny - 1 - y) * nx + x
        if (axis === 1) return (nz - 1 - y) * nx * ny + index * nx + x
        return (nz - 1 - y) * nx * ny + x * nx + index
    }

    private composeRect(
        img: ImageData, axis: Axis, index: number, input: ComposeInput,
        x0: number, y0: number, x1: number, y1: number,
    ) {
        const { base } = input
        const [nx, ny, nz] = base.grid.dims
        const lo = input.wl.level - input.wl.width / 2
        const wInv = 255 / (input.wl.width || 1)
        const baseData = base.data

        const ov = input.overlay
        const ovData = ov && ov.grid.dims[0] === nx && ov.grid.dims[1] === ny && ov.grid.dims[2] === nz ? ov.data : null
        const ovLut = input.overlayLut
        const ovAlpha = input.overlayAlpha
        const ovLo = input.overlayWl.level - input.overlayWl.width / 2
        const ovWInv = 255 / (input.overlayWl.width || 1)
        const ovMin = input.overlay ? input.overlay.intensity.min : 0
        const ovThresh = ovMin + (input.overlay ? (input.overlay.intensity.max - ovMin) * 0.02 : 0)

        const lm = input.labelmap && input.labelmap.length === baseData.length ? input.labelmap : null
        const segs = input.segments
        const labelAlpha = input.labelAlpha

        const px = new Uint32Array(img.data.buffer)
        const w = img.width
        x0 = Math.max(0, x0); y0 = Math.max(0, y0)
        x1 = Math.min(img.width - 1, x1); y1 = Math.min(img.height - 1, y1)
        for (let y = y0; y <= y1; y++) {
            let p = y * w + x0
            for (let x = x0; x <= x1; x++, p++) {
                const idx = this.voxelIndexAt(axis, index, [nx, ny, nz], x, y)
                px[p] = this.pixel(baseData, idx, lo, wInv,
                    ovData, ovLut, ovAlpha, ovLo, ovWInv, ovThresh,
                    lm, segs, labelAlpha)
            }
        }
    }

    private pixel(
        baseData: ArrayLike<number>, idx: number, lo: number, wInv: number,
        ovData: ArrayLike<number> | null, ovLut: Uint32Array | null, ovAlpha: number,
        ovLo: number, ovWInv: number, ovThresh: number,
        lm: Uint16Array | null, segs: Map<number, SegmentStyle>, labelAlpha: number,
    ): number {
        let g = (baseData[idx] - lo) * wInv
        g = g < 0 ? 0 : g > 255 ? 255 : g | 0
        let c = 0xff000000 | (g << 16) | (g << 8) | g
        if (ovData && ovLut && ovAlpha > 0) {
            const ov = ovData[idx]
            if (ov > ovThresh) {
                let t = (ov - ovLo) * ovWInv
                t = t < 0 ? 0 : t > 255 ? 255 : t | 0
                c = alphaBlend(c, ovLut[t], ovAlpha)
            }
        }
        if (lm && labelAlpha > 0) {
            const v = lm[idx]
            if (v) {
                const s = segs.get(v)
                if (s && s.visible) c = alphaBlend(c, s.color, labelAlpha)
            }
        }
        return c
    }

    clear() { this.cache.clear() }
}

/** 全局单例: 三个 MPR 视图共享缓存 */
export const sliceCompositor = new SliceCompositor()
