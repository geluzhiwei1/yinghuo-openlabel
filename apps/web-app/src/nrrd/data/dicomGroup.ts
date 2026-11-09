/**
 * DICOM 分组/排序/配对纯规则 —— 与后端 scripts/import_dicom.py 同一规范(契约二)。
 * 改一处必改另一处。表单预览与工作台运行时共用本实现。
 *
 *  1. 分组键 SeriesInstanceUID;患者 = PatientID 或 UNKNOWN
 *  2. 实例排序 = dot(IPP, normalize(cross(IOP_row, IOP_col))) 升序,永不用 InstanceNumber/文件名
 *  3. 体序列过滤: Modality 白名单 / localizer / 切片数下限 / 多帧 / 几何一致性
 *  4. 配对: PT 找同 Study 同 FrameOfReferenceUID 的 CT(门槛);候选内取 z 物理跨度与 PET
 *     最接近者(GE 同 FoR 常有多个 recon),平手取切片数最多 → |SeriesNumber 差| 最小 →
 *     SeriesNumber 小;找不到 → 未配对(禁止同 Study 盲配)
 *  5. 帧序: patient ↑ → studyDate ↑(空排尾) → Study 内配对帧按 PT SeriesNumber ↑,未配对按 SeriesNumber ↑
 *  6. 命名: <PatientID>_<StudyDate|nodate>_<sanitize(SeriesDesc)|s<SeriesNumber>>;
 *     帧显示名 "<patient> <date|nodate> <modality> <seriesDesc|sN>"
 */
import type { DicomInfo } from './dicomIO'

export const VOLUME_MODALITIES = ['CT', 'MR', 'PT']
export const LOCALIZER_TOKENS = new Set(['LOCALIZER', 'SCOUT', 'LOCALIZER_H', 'TOPGRAM'])
export const MIN_SLICES = 10
export const STREAM_BY_MODALITY: Record<string, string> = { CT: 'ct', PT: 'pet', MR: 'mr' }

export interface SeriesMeta {
    uid: string
    seriesNumber: number
    seriesDesc: string
    modality: string
    forUid: string
    patientId: string
    studyDate: string
}

export interface Series {
    meta: SeriesMeta
    instances: DicomInfo[]
    study?: Study
}

export interface Study {
    meta: { patientId: string; studyUid: string; studyDate: string; studyDesc: string }
    series: Map<string, Series>      // key = series uid
}

export interface PatientTree {
    patientId: string
    studies: Map<string, Study>      // key = study uid
}

// ── 规则 2: 法向/投影/排序 ────────────────────────────────────────────────

export function sliceNormal(iop: number[]): [number, number, number] {
    const [r0, r1, r2, c0, c1, c2] = iop
    let n0 = r1 * c2 - r2 * c1
    let n1 = r2 * c0 - r0 * c2
    let n2 = r0 * c1 - r1 * c0
    const len = Math.hypot(n0, n1, n2) || 1
    n0 /= len; n1 /= len; n2 /= len
    return [n0 || 0, n1 || 0, n2 || 0]   // || 0 把 -0 归一为 +0
}

export function projection(inst: DicomInfo): number {
    const [n0, n1, n2] = sliceNormal(inst.iop)
    const [x, y, z] = inst.ipp
    return x * n0 + y * n1 + z * n2
}

/** 投影升序;投影重复(重复切片,4 位小数)丢弃保留首个。返回 [排序实例, 丢弃数]。 */
export function sortInstances(instances: DicomInfo[]): [DicomInfo[], number] {
    const sorted = [...instances].sort((a, b) => projection(a) - projection(b))
    const out: DicomInfo[] = []
    const seen = new Set<number>()
    let dropped = 0
    for (const inst of sorted) {
        const p = Math.round(projection(inst) * 1e4) / 1e4
        if (seen.has(p)) { dropped++; continue }
        seen.add(p)
        out.push(inst)
    }
    return [out, dropped]
}

export const isLocalizer = (inst: DicomInfo) =>
    (inst.imageType || []).some(t => LOCALIZER_TOKENS.has(String(t).toUpperCase()))

// ── 规则 3: 体序列过滤 ────────────────────────────────────────────────────

export function seriesRejectReason(s: Series, modalities = VOLUME_MODALITIES, minSlices = MIN_SLICES): string | null {
    const m = s.meta
    if (!modalities.includes(m.modality)) return `modality ${m.modality} 不在 ${modalities.join(',')}`
    if (s.instances.some(i => (i.numberOfFrames || 1) > 1)) return '多帧(enhanced/multi-frame)'
    if (isLocalizer(s.instances[0])) return 'localizer/scout'
    if (s.instances.length < minSlices) return `切片数 ${s.instances.length} < ${minSlices}`
    const f0 = s.instances[0]
    for (const inst of s.instances.slice(1)) {
        if (inst.rows !== f0.rows || inst.cols !== f0.cols) return '行/列不一致'
        if (inst.iop.some((v, i) => Math.abs(v - f0.iop[i]) > 1e-3)) return 'IOP 不一致'
    }
    return null
}

// ── 规则 4 配对辅助 ───────────────────────────────────────────────────────

/** 相邻投影差均值 + 均匀性(偏差 ≤ max(0.01mm, 1%) 只警告不剔除)。 */
export function zSpacing(instances: DicomInfo[]): [number, boolean] {
    const ps = instances.map(projection)
    const diffs: number[] = []
    for (let i = 1; i < ps.length; i++) diffs.push(ps[i] - ps[i - 1])
    if (!diffs.length) return [instances[0].sliceThickness || 1, true]
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const tol = Math.max(0.01, Math.abs(mean) * 0.01)
    const uniform = diffs.every(d => Math.abs(d - mean) <= tol)
    return [mean, uniform]
}

export function zExtent(s: Series): number {
    const ps = s.instances.map(projection)
    return ps.length ? Math.abs(Math.max(...ps) - Math.min(...ps)) : 0
}

export interface Pair { study: Study; ct: Series; pet: Series }

/** studies: Map<studyUid, Study>(实例已 sortInstances) → [配对, 未配对CT, 未配对PT]。 */
export function pairSeries(
    studies: Map<string, Study>,
    kept?: Series[],
): [Pair[], Series[], Series[]] {
    // kept 未给时视为全保留;给出时只配对通过体序列过滤的(镜像 Python pair_series(kept_by_study))
    const keptUids = kept ? new Set(kept.map(s => s.meta.uid)) : null
    const isKept = (s: Series) => !keptUids || keptUids.has(s.meta.uid)
    const pairs: Pair[] = []
    const unpairedCt: Series[] = []
    const unpairedPet: Series[] = []
    for (const study of studies.values()) {
        const cts = [...study.series.values()].filter(s => s.meta.modality === 'CT' && isKept(s))
        const pts = [...study.series.values()].filter(s => s.meta.modality === 'PT' && isKept(s))
        const usedCt = new Set<string>()
        for (const pt of pts.sort((a, b) => a.meta.seriesNumber - b.meta.seriesNumber)) {
            const cands = cts.filter(c =>
                !usedCt.has(c.meta.uid)
                && !!c.meta.forUid && !!pt.meta.forUid
                && c.meta.forUid === pt.meta.forUid)
            if (!cands.length) { unpairedPet.push(pt); continue }
            const petExt = zExtent(pt)
            // z 跨度差最小 → 切片数最多 → |SeriesNumber 差| 最小 → SeriesNumber 小 → uid 字典序
            const pick = cands.reduce((best, c) => {
                const key = (s: Series): [number, number, number, number, string] => [
                    Math.round(Math.abs(zExtent(s) - petExt) * 1e3) / 1e3,
                    -s.instances.length,
                    Math.abs(s.meta.seriesNumber - pt.meta.seriesNumber),
                    s.meta.seriesNumber,
                    s.meta.uid,
                ]
                const kc = key(c)
                const kb = key(best)
                for (let i = 0; i < kc.length; i++) {
                    if (kc[i] < kb[i]) return c
                    if (kc[i] > kb[i]) return best
                }
                return best
            })
            usedCt.add(pick.meta.uid)
            pairs.push({ study, ct: pick, pet: pt })
        }
        unpairedCt.push(...cts.filter(c => !usedCt.has(c.meta.uid)))
    }
    return [pairs, unpairedCt, unpairedPet]
}

// ── 规则 1: 分组 ──────────────────────────────────────────────────────────

/** 扁平 infos → 患者树(镜像后端 scan_tree;调用方负责先过滤非 DICOM 文件)。 */
export function groupInstances(infos: DicomInfo[]): Map<string, PatientTree> {
    const patients = new Map<string, PatientTree>()
    for (const inst of infos) {
        let patient = patients.get(inst.patientId)
        if (!patient) {
            patient = { patientId: inst.patientId, studies: new Map() }
            patients.set(inst.patientId, patient)
        }
        const studyUid = inst.studyUid || 'NO-STUDY'
        let study = patient.studies.get(studyUid)
        if (!study) {
            study = {
                meta: { patientId: inst.patientId, studyUid, studyDate: inst.studyDate, studyDesc: inst.studyDesc },
                series: new Map(),
            }
            patient.studies.set(studyUid, study)
        }
        const seriesUid = inst.seriesUid || 'NO-SERIES'
        let series = study.series.get(seriesUid)
        if (!series) {
            series = {
                meta: {
                    uid: seriesUid, seriesNumber: inst.seriesNumber, seriesDesc: inst.seriesDesc,
                    modality: inst.modality, forUid: inst.forUid,
                    patientId: inst.patientId, studyDate: inst.studyDate,
                },
                instances: [],
            }
            study.series.set(seriesUid, series)
        }
        series.instances.push(inst)
    }
    return patients
}

/** groupInstances + sortInstances + series_reject + series 挂 study。 */
export interface GroupResult {
    patients: Map<string, PatientTree>
    kept: Series[]                  // 通过过滤的序列(实例已排序)
    rejected: { series: Series; reason: string }[]
}

export function buildVolumes(infos: DicomInfo[], modalities = VOLUME_MODALITIES, minSlices = MIN_SLICES): GroupResult {
    const patients = groupInstances(infos)
    const kept: Series[] = []
    const rejected: { series: Series; reason: string }[] = []
    for (const patient of patients.values()) {
        for (const study of patient.studies.values()) {
            for (const series of study.series.values()) {
                series.study = study
                const reason = seriesRejectReason(series, modalities, minSlices)
                if (reason) { rejected.push({ series, reason }); continue }
                series.instances = sortInstances(series.instances)[0]
                kept.push(series)
            }
        }
    }
    return { patients, kept, rejected }
}

// ── 规则 5: 帧序 ──────────────────────────────────────────────────────────

export interface FramePair { kind: 'pair'; study: Study; ct: Series; pet: Series }
export interface FrameSingle { kind: 'single'; study: Study; series: Series }
export type FrameEntry = FramePair | FrameSingle

function studySortKey(study: Study): [string, number, string, string] {
    const d = study.meta.studyDate || ''
    return [study.meta.patientId, d === '' ? 1 : 0, d || '99999999', study.meta.studyUid]
}

/** 全局帧序: (患者, 检查日期, 检查uid) 组内: 配对帧在前(按 PT SeriesNumber),未配对随后。 */
export function orderFrames(pairs: Pair[], unpaired: Series[]): FrameEntry[] {
    const frames: { f: FrameEntry; key: (string | number | boolean)[] }[] = []
    for (const p of pairs) {
        frames.push({
            f: { kind: 'pair', study: p.study, ct: p.ct, pet: p.pet },
            key: [...studySortKey(p.study), 0, p.pet.meta.seriesNumber, p.pet.meta.uid],
        })
    }
    for (const s of unpaired) {
        frames.push({
            f: { kind: 'single', study: s.study!, series: s },
            key: [...studySortKey(s.study!), 1, s.meta.seriesNumber, s.meta.uid],
        })
    }
    frames.sort((a, b) => {
        for (let i = 0; i < a.key.length; i++) {
            const x = a.key[i] as any, y = b.key[i] as any
            if (x < y) return -1
            if (x > y) return 1
        }
        return 0
    })
    return frames.map(e => e.f)
}

// ── 规则 6: 命名 ──────────────────────────────────────────────────────────

export function sanitizeName(s: string | null | undefined): string {
    return String(s || '').trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
}

export function outputName(meta: { patientId: string; studyDate: string; seriesDesc: string; seriesNumber: number }): string {
    const part = sanitizeName(meta.seriesDesc) || `s${meta.seriesNumber}`
    return `${sanitizeName(meta.patientId)}_${meta.studyDate || 'nodate'}_${part}`
}

export function frameDisplayName(patient: string, studyDate: string, modality: string, seriesDesc: string, seriesNumber: number): string {
    return `${patient} ${studyDate || 'nodate'} ${modality} ${seriesDesc || 's' + seriesNumber}`
}
