/**
 * 轮廓几何: marching squares 提取 + Douglas-Peucker 简化 + even-odd 扫描线栅格化。
 *
 * 约定:
 * - 掩码采样于整数格点 (u,v) = 体素中心; 轮廓顶点落在格点连线中点(半整数),
 *   即掩码"单元并集"的边界 → 栅格化(中心在内判定)与提取互为逆, round-trip 无损。
 * - 多边形点为闭合环(首尾不重复), rasterizePolygon 用 even-odd 规则(天然支持洞)。
 */
import type { VolumeGrid } from './volumeModel'

export interface Contour {
  closed: boolean
  points: [number, number][]   // (u,v) 平面坐标
}

/** 方向一致的 marching squares 段表(case=四角位码, 内部在行进方向左侧)
 * 边中点: B=(u+.5,v) R=(u+1,v+.5) T=(u+.5,v+1) L=(u,v+.5) */
const CASES: Array<[number, number] | null> = []
CASES[0b0000] = null
CASES[0b0001] = [0, 3]
CASES[0b0010] = [1, 0]
CASES[0b0011] = [1, 3]
CASES[0b0100] = [2, 1]
CASES[0b0101] = null            // 鞍点, 拆两条
CASES[0b0110] = [2, 0]
CASES[0b0111] = [2, 3]
CASES[0b1000] = [3, 2]
CASES[0b1001] = [0, 2]
CASES[0b1010] = null            // 鞍点
CASES[0b1011] = [1, 2]
CASES[0b1100] = [3, 1]
CASES[0b1101] = [0, 1]
CASES[0b1110] = [3, 0]
CASES[0b1111] = null

const edgeMid = (e: number, u: number, v: number): [number, number] =>
  e === 0 ? [u + 0.5, v] : e === 1 ? [u + 1, v + 0.5] : e === 2 ? [u + 0.5, v + 1] : [u, v + 0.5]

/**
 * 从布尔掩码提取闭合轮廓环。
 * mask: (u,v) → 是否在掩码内; w×h 为掩码尺寸; 边界外按 false 处理(轮廓必然闭合)。
 */
export function marchingSquares(
  mask: (u: number, v: number) => boolean,
  w: number, h: number,
): Contour[] {
  const at = (u: number, v: number) => (u < 0 || v < 0 || u >= w || v >= h ? false : mask(u, v))
  // 段表: 起点 key → 多条段(鞍点会重复 key? 不会: 鞍点两条段起点不同)
  const segByStart = new Map<number, { from: [number, number]; to: [number, number]; used: boolean }>()
  // 半整数坐标 ×2 → 整数 key(网格 < 2M 点)
  const kOf = (x: number, y: number) => Math.round(x * 2) * 4194304 + Math.round(y * 2)

  for (let v = -1; v < h; v++) {
    for (let u = -1; u < w; u++) {
      const c0 = at(u, v) ? 1 : 0, c1 = at(u + 1, v) ? 2 : 0
      const c2 = at(u + 1, v + 1) ? 4 : 0, c3 = at(u, v + 1) ? 8 : 0
      const cs = c0 + c1 + c2 + c3
      if (cs === 0 || cs === 15) continue
      const emit = (a: number, b: number) => {
        const s = { from: edgeMid(a, u, v), to: edgeMid(b, u, v), used: false }
        segByStart.set(kOf(s.from[0], s.from[1]), s)
      }
      if (cs === 0b0101) { emit(0, 3); emit(2, 1) }
      else if (cs === 0b1010) { emit(1, 0); emit(3, 2) }
      else { const seg = CASES[cs]!; emit(seg[0], seg[1]) }
    }
  }

  const contours: Contour[] = []
  for (const seg of segByStart.values()) {
    if (seg.used) continue
    seg.used = true
    const pts: [number, number][] = [seg.from]
    let cur = seg
    let guard = 0
    while (guard++ < 4_000_000) {
      pts.push(cur.to)
      if (kOf(cur.to[0], cur.to[1]) === kOf(seg.from[0], seg.from[1])) break
      const next = segByStart.get(kOf(cur.to[0], cur.to[1]))
      if (!next || next.used) break   // 开链(理论不会发生, 防御)
      next.used = true
      cur = next
    }
    // 去掉与首点重复的尾点
    if (pts.length > 1 && kOf(pts[pts.length - 1][0], pts[pts.length - 1][1]) === kOf(pts[0][0], pts[0][1])) pts.pop()
    if (pts.length >= 3) contours.push({ closed: true, points: pts })
  }
  return contours
}

/** 掩码切片 → 轮廓(便利封装, mask 为 w*h 行主序 0/非0) */
export function contoursFromSlice(
  slice: Uint8Array | Uint16Array, w: number, h: number, id = 1,
): Contour[] {
  return marchingSquares((u, v) => slice[v * w + u] === id, w, h)
}

/** 点到线段所在直线的距离(DP 用) */
function distToLine(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  const px = a[0] + t * dx, py = a[1] + t * dy
  return Math.hypot(p[0] - px, p[1] - py)
}

/** 折线 DP 简化(栈实现, 保留 d >= eps - 1e-9 的点, 保证半整数格点极值不丢) */
export function simplifyPolyline(pts: [number, number][], eps: number): [number, number][] {
  const n = pts.length
  if (n < 3) return pts.slice()
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  const tol = eps - 1e-9
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = -1, maxI = -1
    for (let i = s + 1; i < e; i++) {
      const d = distToLine(pts[i], pts[s], pts[e])
      if (d > maxD) { maxD = d; maxI = i }
    }
    if (maxD > tol) {
      keep[maxI] = 1
      stack.push([s, maxI], [maxI, e])
    }
  }
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}

/** 闭合环 DP 简化: 按 u 极值拆两半分别简化再拼回 */
export function simplifyClosed(pts: [number, number][], eps: number): [number, number][] {
  const n = pts.length
  if (n < 5) return pts.slice()
  let iMin = 0, iMax = 0
  for (let i = 1; i < n; i++) {
    if (pts[i][0] < pts[iMin][0]) iMin = i
    if (pts[i][0] > pts[iMax][0]) iMax = i
  }
  if (iMin === iMax) return pts.slice()
  const idx = (i: number) => ((i % n) + n) % n
  const half1: [number, number][] = [], half2: [number, number][] = []
  for (let i = iMin; i !== iMax; i = idx(i + 1)) half1.push(pts[idx(i)])
  half1.push(pts[iMax])
  for (let i = iMax; i !== iMin; i = idx(i + 1)) half2.push(pts[idx(i)])
  half2.push(pts[iMin])
  const s1 = simplifyPolyline(half1, eps)
  const s2 = simplifyPolyline(half2, eps)
  // s1 末点 == s2 首点(iMax), s2 末点 == s1 首点(iMin) → 各去一端拼环
  const out = s1.slice(0, -1).concat(s2.slice(0, -1))
  return out.length >= 3 ? out : pts.slice()
}

/**
 * even-odd 扫描线栅格化: 对每个整数行 v(体素中心行)求多边形交点, 成对填充。
 * set(u,v) 只对中心在多边形内的体素调用; 支持任意多个自交/洞。
 */
export function rasterizePolygon(
  poly: [number, number][],
  w: number, h: number,
  set: (u: number, v: number) => void,
): void {
  const n = poly.length
  if (n < 3) return
  const xs: number[] = []
  for (let v = 0; v < h; v++) {
    xs.length = 0
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n]
      // 半开区间约定: y1 < v <= y2 或 y2 < v <= y1, 顶点不重复计数
      const y1 = a[1], y2 = b[1]
      if ((y1 <= v) !== (y2 <= v)) {
        xs.push(a[0] + (v - y1) / (y2 - y1) * (b[0] - a[0]))
      }
    }
    if (xs.length < 2) continue
    xs.sort((p, q) => p - q)
    for (let t = 0; t + 1 < xs.length; t += 2) {
      const lo = xs[t], hi = xs[t + 1]
      const u0 = Math.max(0, Math.ceil(lo - 1e-7))
      const u1 = Math.min(w - 1, Math.floor(hi + 1e-7))
      for (let u = u0; u <= u1; u++) set(u, v)
    }
  }
}

/** 多环整体 even-odd 栅格化(外环+洞: 洞内体素被两条环各交叉一次 → 偶次 → 不填) */
export function rasterizeContours(
  rings: [number, number][][],
  w: number, h: number,
  set: (u: number, v: number) => void,
): void {
  const xs: number[] = []
  for (let v = 0; v < h; v++) {
    xs.length = 0
    for (const poly of rings) {
      const n = poly.length
      if (n < 3) continue
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n]
        const y1 = a[1], y2 = b[1]
        if ((y1 <= v) !== (y2 <= v)) {
          xs.push(a[0] + (v - y1) / (y2 - y1) * (b[0] - a[0]))
        }
      }
    }
    if (xs.length < 2) continue
    xs.sort((p, q) => p - q)
    for (let t = 0; t + 1 < xs.length; t += 2) {
      const lo = xs[t], hi = xs[t + 1]
      const u0 = Math.max(0, Math.ceil(lo - 1e-7))
      const u1 = Math.min(w - 1, Math.floor(hi + 1e-7))
      for (let u = u0; u <= u1; u++) set(u, v)
    }
  }
}

/** 环面积(带符号, shoelace) */
export function polygonArea(poly: [number, number][]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

/** 轮廓 → Mongo val 文档形态(体素角点坐标转数组) */
export interface ContourDoc {
  axis: 'z' | 'y' | 'x'
  slice: number
  closed: boolean
  points: number[][]   // [u,v,...] 平铺
}

export function contourToDoc(c: Contour, axis: 0 | 1 | 2, slice: number): ContourDoc {
  const flat: number[] = []
  for (const [u, v] of c.points) { flat.push(u, v) }
  return { axis: axis === 0 ? 'x' : axis === 1 ? 'y' : 'z', slice, closed: c.closed, points: flat }
}

export function docToContour(d: ContourDoc): Contour {
  const pts: [number, number][] = []
  for (let i = 0; i + 1 < d.points.length; i += 2) pts.push([d.points[i], d.points[i + 1]])
  return { closed: d.closed, points: pts }
}

/** 轮廓点平面坐标 → 世界坐标(z 轴切片: u=i, v=j) */
export function planeToWorld(
  grid: VolumeGrid, axis: 0 | 1 | 2, slice: number, u: number, v: number,
): [number, number, number] {
  const o = grid.origin, s = grid.spacing
  if (axis === 2) return [o[0] + u * s[0], o[1] + v * s[1], o[2] + slice * s[2]]
  if (axis === 1) return [o[0] + u * s[0], o[1] + slice * s[1], o[2] + v * s[2]]
  return [o[0] + slice * s[0], o[1] + u * s[1], o[2] + v * s[2]]
}
