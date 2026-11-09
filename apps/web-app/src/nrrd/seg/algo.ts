/**
 * 半自动分割算法(纯函数, 主线程/worker/测试共用)。
 * 约定: 索引布局 k*nx*ny + j*nx + i(i 最快), 与 LabelmapVolume.idx 一致。
 * 平面坐标(垂直 axis 的切片): axis=0 → (x=j,y=k), axis=1 → (x=i,y=k), axis=2 → (x=i,y=j)。
 */
import type { VolumeData } from '../data/volumeModel'

export interface PlaneGeom {
    planeW: number
    planeH: number
    nSlices: number
    colStep: number
    rowStep: number
    /** 切片 s 的起始索引 */
    sliceBase(s: number): number
}

export function planeGeometry(dims: readonly [number, number, number], axis: 0 | 1 | 2): PlaneGeom {
    const [nx, ny, nz] = dims
    if (axis === 0) {
        return { planeW: ny, planeH: nz, nSlices: nx, colStep: nx, rowStep: nx * ny, sliceBase: s => s }
    }
    if (axis === 1) {
        return { planeW: nx, planeH: nz, nSlices: ny, colStep: 1, rowStep: nx * ny, sliceBase: s => s * nx }
    }
    return { planeW: nx, planeH: ny, nSlices: nz, colStep: 1, rowStep: nx, sliceBase: s => s * nx * ny }
}

/** 魔法棒: 从种子洪泛, HU∈[lo,hi] 且连通的体素索引(升序)。
 *  scope='slice' 限制在垂直 axis 的种子层(8 连通), 'volume' 全体积(26 连通)。 */
export function magicWandIndices(
    data: VolumeData, dims: readonly [number, number, number],
    seed: readonly [number, number, number],
    lo: number, hi: number,
    scope: 'slice' | 'volume', axis: 0 | 1 | 2,
): Uint32Array {
    const [nx, ny, nz] = dims
    const [si, sj, sk] = seed
    if (si < 0 || sj < 0 || sk < 0 || si >= nx || sj >= ny || sk >= nz) return new Uint32Array(0)
    const seedIdx = sk * nx * ny + sj * nx + si
    const inRange = (idx: number) => { const v = data[idx]; return v >= lo && v <= hi }
    if (!inRange(seedIdx)) return new Uint32Array(0)

    // 邻居索引偏移 + 各坐标的步进(用于环绕防护)
    const plane = planeGeometry(dims, axis)
    const offsets: number[] = []
    if (scope === 'volume') {
        for (let dk = -1; dk <= 1; dk++)
            for (let dj = -1; dj <= 1; dj++)
                for (let di = -1; di <= 1; di++) {
                    if (!di && !dj && !dk) continue
                    offsets.push(dk * nx * ny + dj * nx + di)
                }
    } else {
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue
                offsets.push(dy * plane.rowStep + dx * plane.colStep)
            }
    }

    const visited = new Uint8Array(data.length)
    const queue = new Int32Array(data.length)
    let qh = 0, qt = 0
    queue[qt++] = seedIdx
    visited[seedIdx] = 1
    const out: number[] = []

    while (qh < qt) {
        const idx = queue[qh++]
        out.push(idx)
        const k = (idx / (nx * ny)) | 0
        const j = ((idx - k * nx * ny) / nx) | 0
        const i = idx - k * nx * ny - j * nx
        for (const off of offsets) {
            const n = idx + off
            if (n < 0 || n >= data.length) continue
            const nk = (n / (nx * ny)) | 0
            const nj = ((n - nk * nx * ny) / nx) | 0
            const ni = n - nk * nx * ny - nj * nx
            // 环绕防护: 位移在体素坐标上是真邻居(|Δ|≤1)
            if (Math.abs(ni - i) > 1 || Math.abs(nj - j) > 1 || Math.abs(nk - k) > 1) continue
            if (visited[n] || !inRange(n)) continue
            visited[n] = 1
            queue[qt++] = n
        }
    }
    return new Uint32Array(out.sort((a, b) => a - b))
}

// ── 距离场跨层插值 ─────────────────────────────────────────

/** 二值图带符号距离(chamfer 3-4): 近似真 SDF(边界在半体素处), 内部>0, 外部<0。
 *  内部 = dOut-0.5, 外部 = -(dIn-0.5)(dOut/dIn 为到最近异类体素中心的 chamfer 步数),
 *  两端场线性混合时偏置对称抵消, 过渡带不内缩/外扩。 */
function signedDistance2D(mask: Uint8Array, w: number, h: number, out: Float32Array): void {
    const INF = 1e9
    // 复用两段缓冲算"到最近内部/外部距离"
    const buf = new Float32Array(w * h)
    const relax = (d: Float32Array, forward: boolean) => {
        const yStart = forward ? 0 : h - 1
        const yEnd = forward ? h : -1
        const yStep = forward ? 1 : -1
        for (let y = yStart; y !== yEnd; y += yStep) {
            for (let x = 0; x < w; x++) {
                const t = y * w + x
                let v = d[t]
                const xp = x - 1, xn = x + 1
                if (forward) {
                    if (xp >= 0) v = Math.min(v, d[t - 1] + 3)
                    const yPrev = y - yStep
                    if (yPrev >= 0 && yPrev < h) {
                        v = Math.min(v, d[t - w] + 3)
                        if (xp >= 0) v = Math.min(v, d[t - w - 1] + 4)
                        if (xn < w) v = Math.min(v, d[t - w + 1] + 4)
                    }
                } else {
                    if (xn < w) v = Math.min(v, d[t + 1] + 3)
                    const yPrev = y - yStep
                    if (yPrev >= 0 && yPrev < h) {
                        v = Math.min(v, d[t + w] + 3)
                        if (xn < w) v = Math.min(v, d[t + w + 1] + 4)
                        if (xp >= 0) v = Math.min(v, d[t + w - 1] + 4)
                    }
                }
                d[t] = v
            }
        }
    }
    // d(mask→最近0): 内部体素到边界的距离
    for (let t = 0; t < w * h; t++) buf[t] = mask[t] ? 0 : INF
    relax(buf, true); relax(buf, false)
    for (let t = 0; t < w * h; t++) if (!mask[t]) out[t] = 0.5 - buf[t] / 3
    // d(0→最近mask): 外部体素到边界的距离
    for (let t = 0; t < w * h; t++) buf[t] = mask[t] ? INF : 0
    relax(buf, true); relax(buf, false)
    for (let t = 0; t < w * h; t++) {
        if (mask[t]) out[t] = buf[t] / 3 - 0.5
    }
}

/**
 * 跨层插值(shape-based): mask 为某 segment 的二值体积, 沿 axis 在相邻
 * 有标注层之间做带符号距离场线性插值。返回"新增体素"索引(当前 mask=0
 * 且插值判定为内部), 升序。仅一层有标注或层间无缺口时返回空。
 */
export function interpolateIndices(
    mask: Uint8Array, dims: readonly [number, number, number], axis: 0 | 1 | 2,
): Uint32Array {
    const plane = planeGeometry(dims, axis)
    const { planeW, planeH, nSlices, colStep, rowStep } = plane

    // 有标注的层(任一体素为 1)
    const annotated: number[] = []
    for (let s = 0; s < nSlices; s++) {
        const base = plane.sliceBase(s)
        let any = false
        for (let y = 0; y < planeH && !any; y++) {
            const row = base + y * rowStep
            for (let x = 0; x < planeW; x++) {
                if (mask[row + x * colStep]) { any = true; break }
            }
        }
        if (any) annotated.push(s)
    }
    if (annotated.length < 2) return new Uint32Array(0)

    const n = planeW * planeH
    const sliceMask = new Uint8Array(n)
    const dist: (Float32Array | undefined)[] = new Array(nSlices)
    for (const s of annotated) {
        const base = plane.sliceBase(s)
        for (let y = 0; y < planeH; y++) {
            const row = base + y * rowStep
            for (let x = 0; x < planeW; x++) sliceMask[y * planeW + x] = mask[row + x * colStep]
        }
        const d = new Float32Array(n)
        signedDistance2D(sliceMask, planeW, planeH, d)
        dist[s] = d
    }

    const out: number[] = []
    for (let a = 0; a + 1 < annotated.length; a++) {
        const s0 = annotated[a], s1 = annotated[a + 1]
        if (s1 - s0 < 2) continue
        const d0 = dist[s0]!, d1 = dist[s1]!
        for (let s = s0 + 1; s < s1; s++) {
            const alpha = (s - s0) / (s1 - s0)
            const base = plane.sliceBase(s)
            for (let y = 0; y < planeH; y++) {
                const row = base + y * rowStep
                for (let x = 0; x < planeW; x++) {
                    const p = y * planeW + x
                    if ((1 - alpha) * d0[p] + alpha * d1[p] > 0) {
                        const idx = row + x * colStep
                        if (!mask[idx]) out.push(idx)
                    }
                }
            }
        }
    }
    return new Uint32Array(out.sort((a, b) => a - b))
}

// ── Live Wire(智能剪刀) ─────────────────────────────────────

/**
 * 切片边缘代价场: 3×3 Sobel 梯度幅值 → exp(-|g|/k), k=max/8。
 * 平坦区≈1, 强边≈0; 边界一圈保持 1。
 */
export function edgeCostField(
    data: VolumeData, dims: readonly [number, number, number],
    axis: 0 | 1 | 2, slice: number,
): Float32Array {
    const plane = planeGeometry(dims, axis)
    const { planeW: w, planeH: h, colStep, rowStep } = plane
    const n = w * h
    const img = new Float32Array(n)
    const base = plane.sliceBase(slice)
    for (let y = 0; y < h; y++) {
        const row = base + y * rowStep
        for (let x = 0; x < w; x++) img[y * w + x] = data[row + x * colStep]
    }
    const grad = new Float32Array(n)
    let maxG = 0
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const t = y * w + x
            const gx = -img[t - w - 1] - 2 * img[t - 1] - img[t + w - 1]
                + img[t - w + 1] + 2 * img[t + 1] + img[t + w + 1]
            const gy = -img[t - w - 1] - 2 * img[t - w] - img[t - w + 1]
                + img[t + w - 1] + 2 * img[t + w] + img[t + w + 1]
            const g = Math.hypot(gx, gy) / 8
            grad[t] = g
            if (g > maxG) maxG = g
        }
    }
    const cost = new Float32Array(n).fill(1)
    if (maxG <= 0) return cost
    const k = maxG / 8
    for (let t = 0; t < n; t++) cost[t] = Math.exp(-grad[t] / k)
    return cost
}

export interface LiveWireTree {
    dist: Float32Array
    prev: Int32Array
    src: number
    w: number
    h: number
}

/** 8 邻域 Dijkstra: 步进代价 = 0.99·节点代价 + 0.01·步长。 */
export function liveWireTree(cost: Float32Array, w: number, h: number, src: number): LiveWireTree {
    const n = w * h
    const dist = new Float32Array(n).fill(Infinity)
    const prev = new Int32Array(n).fill(-1)
    const visited = new Uint8Array(n)
    const heap = new Uint32Array(n)
    const hDist = new Float32Array(n)
    let hn = 0
    const push = (node: number, d: number) => {
        heap[hn] = node; hDist[hn] = d
        let i = hn++
        while (i > 0) {
            const p = (i - 1) >> 1
            if (hDist[p] <= hDist[i]) break
            const tn = heap[p], td = hDist[p]
            heap[p] = heap[i]; hDist[p] = hDist[i]
            heap[i] = tn; hDist[i] = td
            i = p
        }
    }
    const pop = (): number => {
        const top = heap[0]
        hn--
        heap[0] = heap[hn]; hDist[0] = hDist[hn]
        let i = 0
        for (;;) {
            const l = i * 2 + 1, r = l + 1
            let m = i
            if (l < hn && hDist[l] < hDist[m]) m = l
            if (r < hn && hDist[r] < hDist[m]) m = r
            if (m === i) break
            const tn = heap[m], td = hDist[m]
            heap[m] = heap[i]; hDist[m] = hDist[i]
            heap[i] = tn; hDist[i] = td
            i = m
        }
        return top
    }
    const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
    const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
    const LEN = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2]
    dist[src] = 0
    push(src, 0)
    while (hn > 0) {
        const t = pop()
        if (visited[t]) continue
        visited[t] = 1
        const x = t % w, y = (t / w) | 0
        const d0 = dist[t]
        for (let q = 0; q < 8; q++) {
            const nx = x + DX[q], ny = y + DY[q]
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const u = ny * w + nx
            if (visited[u]) continue
            const nd = d0 + cost[u] * 0.99 + 0.01 * LEN[q]
            if (nd < dist[u]) {
                dist[u] = nd
                prev[u] = t
                push(u, nd)
            }
        }
    }
    return { dist, prev, src, w, h }
}

/** 回溯 src→dst 路径(平面坐标, 含两端)。 */
export function liveWirePath(tree: LiveWireTree, dst: number): [number, number][] {
    const out: [number, number][] = []
    let t = dst
    let guard = tree.w * tree.h
    while (t !== -1 && guard-- > 0) {
        out.push([t % tree.w, (t / tree.w) | 0])
        if (t === tree.src) break
        t = tree.prev[t]
    }
    out.reverse()
    return out
}

// ── GrowCut(种子竞争) ───────────────────────────────────────

/**
 * 经典 GrowCut 元胞自动机: 前后交替扫掠传播 label(1=fg, 2=bg),
 * 强度 s = s(q)·exp(-ΔI²/σ²)。返回 fg 胜出的体素索引(升序, 含种子)。
 * 收敛(无变化)或 30 轮为止; cancelled 每轮检查。
 */
export function growCutIndices(
    data: VolumeData, dims: readonly [number, number, number],
    fg: Uint8Array, bg: Uint8Array, sigma: number,
    onProgress?: (frac: number) => void,
    cancelled?: () => boolean,
): Uint32Array {
    const [nx, ny, nz] = dims
    const n = data.length
    if (fg.length !== n || bg.length !== n) throw new Error('种子层与体数据尺寸不一致')
    const label = new Uint8Array(n)
    const strength = new Float32Array(n)
    let nFg = 0, nBg = 0
    for (let t = 0; t < n; t++) {
        if (fg[t]) { label[t] = 1; strength[t] = 1; nFg++ }
        else if (bg[t]) { label[t] = 2; strength[t] = 1; nBg++ }
    }
    if (!nFg || !nBg) return new Uint32Array(0)
    const sigmaSq = Math.max(1e-6, sigma * sigma)
    const MAX_PASSES = 30
    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let changed = 0
        const forward = pass % 2 === 0
        const start = forward ? 0 : n - 1
        const end = forward ? n : -1
        const step = forward ? 1 : -1
        for (let t = start; t !== end; t += step) {
            const k = (t / (nx * ny)) | 0
            const j = ((t - k * nx * ny) / nx) | 0
            const i = t - k * nx * ny - j * nx
            let bestS = strength[t]
            let bestL = label[t]
            for (let q = 0; q < 6; q++) {
                let ni = i, nj = j, nk = k
                if (q === 0) ni = i - 1
                else if (q === 1) ni = i + 1
                else if (q === 2) nj = j - 1
                else if (q === 3) nj = j + 1
                else if (q === 4) nk = k - 1
                else nk = k + 1
                if (ni < 0 || nj < 0 || nk < 0 || ni >= nx || nj >= ny || nk >= nz) continue
                const u = nk * nx * ny + nj * nx + ni
                const lu = label[u]
                if (!lu) continue
                const g = data[t] - data[u]
                const s = strength[u] * Math.exp(-(g * g) / sigmaSq)
                if (s > bestS) { bestS = s; bestL = lu }
            }
            if (bestL !== label[t]) changed++
            strength[t] = bestS
            label[t] = bestL
        }
        onProgress?.((pass + 1) / MAX_PASSES)
        if (!changed) break
        if (cancelled?.()) throw new Error('cancelled')
    }
    const out: number[] = []
    for (let t = 0; t < n; t++) if (label[t] === 1) out.push(t)
    return new Uint32Array(out)
}
