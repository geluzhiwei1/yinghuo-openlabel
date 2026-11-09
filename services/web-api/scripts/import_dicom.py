"""DICOM 原生导入: 患者→检查→序列 分组、序列装配 NRRD、CT/PT 自动配对、建 job。

3D Slicer 式数据组织: 层级与配对信息全部来自 DICOM 头(PatientID/StudyInstanceUID/
SeriesInstanceUID/Modality/FrameOfReferenceUID),不依赖文件名排序约定。

用法(dev):
  cd services/web-api
  YH_CONFIG_FILE=config/yinghuo.yaml YH_JWT_SECRET=... PYTHONPATH=src \
    .venv/bin/python -m scripts.import_dicom --input /path/to/dicom \
    --out-name med-dicom-import-x --fusion-job-name 融合任务 --dry-run

规则与前端 src/nrrd/data/dicomGroup.ts 是同一规范的两份实现(契约二,改一处必改另一处):
  1. 分组键 SeriesInstanceUID;患者 = PatientID 或 UNKNOWN
  2. 实例排序 = dot(IPP, normalize(cross(IOP_row, IOP_col))) 升序,永不用 InstanceNumber/文件名
  3. 体序列过滤: Modality 白名单 / ImageType 含 LOCALIZER|SCOUT / 切片数下限 / 多帧 / 几何一致性
  4. 配对: PT 找同 Study 同 FrameOfReferenceUID 的 CT(门槛);候选内取物理 z 跨度与 PET 最接近者
     (GE 同 FoR 常有多个 recon,head PET 的 FoR 会同时匹配 lung recon),平手取切片数最多,
     再 |SeriesNumber 差| 最小,SeriesNumber 小;找不到 → 未配对(禁止同 Study 盲配)
  5. 帧序: patient ↑ → studyDate ↑(空排尾) → Study 内配对帧按 PT SeriesNumber ↑,未配对按 SeriesNumber ↑
  6. 输出名: <PatientID>_<StudyDate|nodate>_<sanitize(SeriesDesc)|s<SeriesNumber>>.nrrd
     冲突追加 _<SeriesInstanceUID 尾8>

pydicom/SimpleITK 惰性导入(可选 extra `dicom`);纯规则函数无重依赖,pytest 直测。
"""
import argparse
import asyncio
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

VOLUME_MODALITIES = ("CT", "MR", "PT")
LOCALIZER_TOKENS = {"LOCALIZER", "SCOUT", "LOCALIZER_H", "TOPGRAM"}
MIN_SLICES = 10
STREAM_BY_MODALITY = {"CT": "ct", "PT": "pet", "MR": "mr"}
NAME_KEYS = ("name", "patient", "patientName", "studyDate", "studyUid", "studyDesc",
             "seriesUid", "seriesDesc", "modality", "pairedModality")


# ── 纯规则(与 dicomGroup.ts 同规范;输入是扁平标签 dict,无 pydicom) ──────────

def slice_normal(iop):
    r, c = iop[0:3], iop[3:6]
    n = (r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0])
    ln = math.sqrt(sum(x * x for x in n)) or 1.0
    return (n[0] / ln, n[1] / ln, n[2] / ln)


def projection(inst):
    ipp = inst["ipp"]
    n = slice_normal(inst["iop"])
    return ipp[0] * n[0] + ipp[1] * n[1] + ipp[2] * n[2]


def sort_instances(instances):
    """按 IPP 在切片法向上的投影升序;投影重复(重复切片)保留首个并记警告。"""
    out, seen, dropped = [], {}, 0
    for inst in sorted(instances, key=projection):
        p = round(projection(inst), 4)
        if p in seen:
            dropped += 1
            continue
        seen[p] = True
        out.append(inst)
    return out, dropped


def is_localizer(inst):
    return any(str(t).upper() in LOCALIZER_TOKENS for t in inst.get("image_type") or [])


def series_reject_reason(series, modalities=VOLUME_MODALITIES, min_slices=MIN_SLICES):
    """返回剔除原因字符串,None=保留。series={'meta':dict,'instances':[...]}。"""
    m = series["meta"]
    if m["modality"] not in modalities:
        return f"modality {m['modality']} 不在 {list(modalities)}"
    if any(inst.get("number_of_frames", 1) and inst["number_of_frames"] > 1
           for inst in series["instances"]):
        return "多帧(enhanced/multi-frame)"
    if is_localizer(series["instances"][0]):
        return "localizer/scout"
    if len(series["instances"]) < min_slices:
        return f"切片数 {len(series['instances'])} < {min_slices}"
    f0 = series["instances"][0]
    for inst in series["instances"][1:]:
        if inst["rows"] != f0["rows"] or inst["cols"] != f0["cols"]:
            return "行/列不一致"
        if max(abs(a - b) for a, b in zip(inst["iop"], f0["iop"])) > 1e-3:
            return "IOP 不一致"
    return None


def z_spacing(instances):
    ps = [projection(i) for i in instances]
    diffs = [b - a for a, b in zip(ps, ps[1:])]
    if not diffs:
        return float(instances[0].get("slice_thickness") or 1.0), True
    mean = sum(diffs) / len(diffs)
    tol = max(0.01, abs(mean) * 0.01)
    return mean, max(abs(d - mean) for d in diffs) <= tol


def _z_extent(series):
    ps = [projection(i) for i in series["instances"]]
    return abs(max(ps) - min(ps)) if ps else 0.0


def pair_series(kept_by_study):
    """studies: {study_uid: {'meta':..,'series':{uid:series}}} → (pairs, unpaired_ct, unpaired_pet)。

    pair = {'ct': series, 'pet': series}。GE 数据实测发现同 FoR 的 CT 不止一个
    (head PET 的 FoR 同时匹配 lung recon),纯 FoR+切片数会把 HEAD PET 配给 LUNG CT,
    因此候选内先按物理 z 跨度最接近 PET 排序(WB PET 跨度远大于 lung;head≈head)。
    """
    pairs, unpaired_ct, unpaired_pet = [], [], []
    for study_uid, study in kept_by_study.items():
        cts = [s for s in study["series"].values() if s["meta"]["modality"] == "CT"]
        pts = [s for s in study["series"].values() if s["meta"]["modality"] == "PT"]
        used_ct = set()
        for pt in sorted(pts, key=lambda s: s["meta"]["series_number"]):
            cands = [c for c in cts
                     if c["meta"]["uid"] not in used_ct
                     and c["meta"]["for_uid"] and pt["meta"]["for_uid"]
                     and c["meta"]["for_uid"] == pt["meta"]["for_uid"]]
            if not cands:
                unpaired_pet.append(pt)
                continue
            pet_ext = _z_extent(pt)
            # z 跨度差最小 → 切片数最多 → |SeriesNumber 差| 最小 → SeriesNumber 小 → uid 字典序
            pick = min(cands, key=lambda c: (round(abs(_z_extent(c) - pet_ext), 3),
                                             -len(c["instances"]),
                                             abs(c["meta"]["series_number"] - pt["meta"]["series_number"]),
                                             c["meta"]["series_number"], c["meta"]["uid"]))
            used_ct.add(pick["meta"]["uid"])
            pairs.append({"study": study, "ct": pick, "pet": pt})
        unpaired_ct += [c for c in cts if c["meta"]["uid"] not in used_ct]
    return pairs, unpaired_ct, unpaired_pet


def _study_sort_key(study):
    d = study["meta"]["study_date"] or ""
    return (study["meta"]["patient_id"], d == "", d or "99999999", study["meta"]["study_uid"])


def order_frames(pairs, unpaired):
    """全局帧序(规则 5): 返回 [{'pair'|'series': ...}] 有序列表。"""
    frames = []
    for p in pairs:
        frames.append({"kind": "pair", "study": p["study"], "ct": p["ct"], "pet": p["pet"],
                       "order": (p["pet"]["meta"]["series_number"], p["pet"]["meta"]["uid"])})
    for s in unpaired:
        frames.append({"kind": "single", "study": s["study"], "series": s,
                       "order": (s["meta"]["series_number"], s["meta"]["uid"])})
    # 先按 (患者, 检查日期, 检查uid) 分组排序,组内再按 order
    frames.sort(key=lambda f: (_study_sort_key(f["study"]), f["kind"] != "pair", f["order"]))
    return frames


def sanitize_name(s):
    s = re.sub(r"[^A-Za-z0-9_-]+", "_", str(s or "").strip())
    return s.strip("_")


def output_name(meta):
    part = sanitize_name(meta["series_desc"]) or f"s{meta['series_number']}"
    return f"{sanitize_name(meta['patient_id'])}_{meta['study_date'] or 'nodate'}_{part}"


def frame_display_name(patient, study_date, modality, series_desc, series_number):
    return f"{patient} {study_date or 'nodate'} {modality} {series_desc or 's' + str(series_number)}"


# ── DICOM I/O(pydicom/SimpleITK 惰性导入) ────────────────────────────────

def sniff_dicom(path):
    try:
        with open(path, "rb") as f:
            return f.read(132)[128:132] == b"DICM"
    except OSError:
        return False


def _num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def read_instance(path):
    import pydicom
    ds = pydicom.dcmread(str(path), stop_before_pixels=True, force=False)
    iop = [_num(x) for x in ds.get("ImageOrientationPatient", [1, 0, 0, 0, 1, 0])]
    ipp = [_num(x) for x in ds.get("ImagePositionPatient", [0, 0, 0])]
    try:
        dose = float(ds.RadiopharmaceuticalInformationSequence[0].RadionuclideTotalDose)
    except Exception:
        dose = None
    return {
        "path": str(path),
        "patient_id": str(ds.get("PatientID") or "UNKNOWN").strip() or "UNKNOWN",
        "patient_name": str(ds.get("PatientName") or "").strip(),
        "study_uid": str(ds.get("StudyInstanceUID") or ""),
        "study_date": str(ds.get("StudyDate") or "").strip(),
        "study_desc": str(ds.get("StudyDescription") or "").strip(),
        "series_uid": str(ds.get("SeriesInstanceUID") or ""),
        "series_number": int(_num(ds.get("SeriesNumber"), 0)),
        "series_desc": str(ds.get("SeriesDescription") or "").strip(),
        "modality": str(ds.get("Modality") or "").strip().upper(),
        "image_type": [str(t) for t in (ds.get("ImageType") or [])],
        "iop": iop, "ipp": ipp,
        "pixel_spacing": [_num(x) for x in ds.get("PixelSpacing", [1, 1])],
        "rows": int(ds.get("Rows") or 0), "cols": int(ds.get("Columns") or 0),
        "for_uid": str(ds.get("FrameOfReferenceUID") or ""),
        "units": str(ds.get("Units") or "").strip(),
        "decay_correction": str(ds.get("DecayCorrection") or "").strip(),
        "weight_kg": _num(ds.get("PatientWeight"), 0.0),
        "dose_bq": dose,
        "number_of_frames": int(_num(ds.get("NumberOfFrames"), 1)),
        "transfer_syntax": str(getattr(getattr(ds, "file_meta", None), "TransferSyntaxUID", "") or ""),
        "slice_thickness": _num(ds.get("SliceThickness"), 0.0),
    }


def scan_tree(root, log=print):
    import pydicom  # noqa: F401 触发早失败
    patients = {}  # pid -> {study_uid -> study}
    n_files = n_dcm = 0
    for dirpath, _dirs, files in _walk(root):
        for fn in files:
            n_files += 1
            p = Path(dirpath) / fn
            if not sniff_dicom(p):
                continue
            n_dcm += 1
            try:
                inst = read_instance(p)
            except Exception as e:
                log(f"  [warn] 解析失败 {p.name}: {e}")
                continue
            study = patients.setdefault(inst["patient_id"], {}).setdefault(
                inst["study_uid"] or "NO-STUDY",
                {"meta": {"patient_id": inst["patient_id"], "study_uid": inst["study_uid"] or "NO-STUDY",
                          "study_date": inst["study_date"], "study_desc": inst["study_desc"]},
                 "series": {}})
            series = study["series"].setdefault(
                inst["series_uid"] or "NO-SERIES",
                {"meta": {"uid": inst["series_uid"] or "NO-SERIES",
                          "series_number": inst["series_number"], "series_desc": inst["series_desc"],
                          "modality": inst["modality"], "for_uid": inst["for_uid"],
                          "patient_id": inst["patient_id"], "study_date": inst["study_date"]},
                 "instances": []})
            series["instances"].append(inst)
    return patients, n_files, n_dcm


def _walk(root):
    import os
    for dirpath, _dirs, files in os.walk(root):
        yield dirpath, _dirs, files


def assemble_series(series):
    """排序实例 → SimpleITK 装配。返回 (sitk.Image, warnings:list[str])。"""
    import SimpleITK as sitk
    instances, dropped = sort_instances(series["instances"])
    warns = []
    if dropped:
        warns.append(f"丢弃 {dropped} 个投影重复实例")
    zs, uniform = z_spacing(instances)
    if not uniform:
        warns.append(f"z 间距不均匀(均值 {zs:.4g}mm)")
    f0 = instances[0]
    if abs(f0["iop"][0] * f0["iop"][3] + f0["iop"][1] * f0["iop"][4] + f0["iop"][2] * f0["iop"][5]) > 1e-6:
        warns.append("斜切序列(gantry tilt/oblique),方向按 DICOM 方向矩阵保留")
    reader = sitk.ImageSeriesReader()
    reader.SetFileNames([i["path"] for i in instances])
    img = reader.Execute()
    return img, warns


def suv_scale(series):
    """BQML+DecayCorrection=START(GE) → 体重g/注射剂量Bq;其余 None(直通,记警告由调用方)。"""
    f0 = series["instances"][0]
    if f0["units"].upper().startswith("SUV"):
        return None, None
    if not (f0["units"].upper() == "BQML" and f0["decay_correction"].upper() == "START"):
        return None, f"Units={f0['units']} DecayCorrection={f0['decay_correction']} 不支持 SUV 换算,原样直通"
    if not (f0["weight_kg"] > 0 and f0["dose_bq"]):
        return None, "缺体重/注射剂量,原样直通"
    return f0["weight_kg"] * 1000.0 / f0["dose_bq"], None


def write_volume(img, path, scale=None):
    import numpy as np
    import SimpleITK as sitk
    path.parent.mkdir(parents=True, exist_ok=True)
    if scale is not None:
        a = sitk.GetArrayFromImage(img).astype(np.float32) * scale
        out = sitk.GetImageFromArray(a)
        out.CopyInformation(img)
        img = out
    sitk.WriteImage(img, str(path), True)


# ── 主流程 ──────────────────────────────────────────────────────────────

def build_manifest_entries(frames):
    entries = []
    for f in frames:
        if f["kind"] == "pair":
            ct, pet, st = f["ct"], f["pet"], f["study"]["meta"]
            entries.append({
                "name": frame_display_name(st["patient_id"], st["study_date"], "CT",
                                           ct["meta"]["series_desc"], ct["meta"]["series_number"]),
                "patient": st["patient_id"], "patientName": f["ct"]["instances"][0]["patient_name"],
                "studyDate": st["study_date"], "studyUid": st["study_uid"], "studyDesc": st["study_desc"],
                "seriesUid": ct["meta"]["uid"], "seriesDesc": ct["meta"]["series_desc"],
                "modality": "CT", "pairedModality": "PT",
                "streams": {"ct": f"ct/{ct['out_name']}.nrrd", "pet": f"pet/{pet['out_name']}.nrrd"},
            })
        else:
            s, st = f["series"], f["study"]["meta"]
            stream = STREAM_BY_MODALITY[s["meta"]["modality"]]
            entries.append({
                "name": frame_display_name(st["patient_id"], st["study_date"], s["meta"]["modality"],
                                           s["meta"]["series_desc"], s["meta"]["series_number"]),
                "patient": st["patient_id"], "patientName": s["instances"][0]["patient_name"],
                "studyDate": st["study_date"], "studyUid": st["study_uid"], "studyDesc": st["study_desc"],
                "seriesUid": s["meta"]["uid"], "seriesDesc": s["meta"]["series_desc"],
                "modality": s["meta"]["modality"],
                "streams": {stream: f"{stream}/{s['out_name']}.nrrd"},
            })
    return entries


def assign_output_names(series_list, out_root):
    """每序列分配流目录内唯一文件名(规则 6)。"""
    used = {}
    for s in series_list:
        stream = STREAM_BY_MODALITY[s["meta"]["modality"]]
        base = output_name(s["meta"])
        names = used.setdefault(stream, set())
        if base in names:
            uid_tail = s["meta"]["uid"].replace(".", "")[-8:]
            base = f"{base}_{uid_tail}"
        names.add(base)
        s["out_name"] = base
        s["out_path"] = out_root / stream / f"{base}.nrrd"


def report(tree_state, frames, skipped, log=print):
    patients, pairs, unpaired_ct, unpaired_pet = tree_state
    log(f"\n患者 {len(patients)} 位:")
    for pid, studies in sorted(patients.items()):
        for su, st in studies.items():
            log(f"  {pid} | study {st['meta']['study_date'] or 'nodate'} "
                f"{st['meta']['study_desc'][:40]} | 序列 {len(st['series'])}")
    if skipped:
        log("\n剔除序列:")
        for s, reason in skipped:
            m = s["meta"]
            log(f"  [{reason}] {m['patient_id']} {m['modality']} "
                f"\"{m['series_desc'][:30]}\" #{m['series_number']}")
    log(f"\n配对 {len(pairs)} 对(CT+PT 同 FrameOfReference):")
    for p in pairs:
        log(f"  {p['study']['meta']['patient_id']} {p['study']['meta']['study_date']}: "
            f"CT \"{p['ct']['meta']['series_desc'][:24]}\"({len(p['ct']['instances'])} 层) ← "
            f"PT \"{p['pet']['meta']['series_desc'][:24]}\"({len(p['pet']['instances'])} 层)")
    if unpaired_pet:
        log(f"\n未配对 PET {len(unpaired_pet)} 个(无同 FoR 的 CT,排除出融合):")
        for s in unpaired_pet:
            log(f"  {s['meta']['patient_id']} {s['meta']['series_desc'][:30]}")
    log(f"\n帧序({len(frames)} 帧):")
    for i, f in enumerate(frames):
        if f["kind"] == "pair":
            log(f"  {i}: [融合] {f['study']['meta']['patient_id']} {f['study']['meta']['study_date']} "
                f"{f['ct']['meta']['series_desc'][:24]} + {f['pet']['meta']['series_desc'][:24]}")
        else:
            m = f["series"]["meta"]
            log(f"  {i}: [{m['modality']}] {m['patient_id']} {m['study_date']} {m['series_desc'][:30]}")


def create_jobs(job_specs):
    """job_specs: [(out_name, job_name, entries), ...] — 每个输出目录一个独立 job。"""
    from tortoise import Tortoise
    from openlabel import OpenLabel
    from yinghuo_conf.config import gConf
    from yinghuo_app.biz.db.collection import AnnoJob
    from yinghuo_app.biz.db.models import User
    from yinghuo_app.biz.services.job import job_service
    from yinghuo_app.biz.services.user import user_service
    from yinghuo_app.config import Conf, settings

    specs = OpenLabel.available_taxonomy("medical-volume")
    taxonomy = {"key": specs[0]["taxonomy_key"], "type": "system",
                "name": specs[0].get("name", ""), "domain": "medical-volume"}

    async def _run():
        await Tortoise.init(config=settings.TORTOISE_ORM, _enable_global_fallback=True)
        try:
            users = await User.all()
            user_ids = [u.id for u in users]
            admin = await user_service.get_by_email(gConf["admin"]["user"])

            made = []
            for out_name, job_name, entries in job_specs:
                if not job_name or not entries:
                    continue
                if Conf.MG_ANNO_JOB_PERFORM.find_one({"name": job_name}):
                    print(f"job 已存在, 跳过: {job_name}")
                    continue
                streams = []
                for e in entries:
                    for s in e["streams"]:
                        if s not in streams:
                            streams.append(s)
                dto = AnnoJob(name=job_name,
                              desc=f"DICOM 原生导入(scripts/import_dicom.py; {len(entries)} 帧)",
                              priority=1, type=0, version="1.0.0", taxonomy_key="",
                              label_spec={"domain": {"key": "medical-volume"},
                                          "mission": {"key": "volumeSegment3d"},
                                          "taxonomy": taxonomy,
                                          "data": {"clip_key": "", "format": "simple-directory",
                                                   "root_dir": "", "seq": f"shared-datas/{out_name}",
                                                   "dataSource": "serverLocalDir",
                                                   "streams": streams, "file_exts": [".nrrd"],
                                                   "imageURLs": []}})
                await job_service.create_job(admin.id, dto)
                seq = f"shared-datas/{out_name}"
                Conf.MG_ANNO_JOB_PERFORM.update_many(
                    {"label_spec.data.seq": seq}, {"$set": {"authority.owners": user_ids}})
                Conf.MG_DATA_SEQ_META.update_many(
                    {"job.seq": seq}, {"$set": {"authority.owners": user_ids}})
                Conf.MG_DATA_STREAM_META.update_many(
                    {"job.seq": seq}, {"$set": {"authority.owners": user_ids}})
                made.append(job_name)
                print(f"job 已创建: {job_name} ({len(entries)} 帧, streams={streams}, seq={seq})")
            return made
        finally:
            await Tortoise.close_connections()

    return asyncio.run(_run())


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--input", required=True, help="DICOM 根目录(任意布局)")
    ap.add_argument("--out-name", required=True, help="shared-datas 下的融合输出目录名(配对 ct+pet)")
    ap.add_argument("--ct-out-name", default=None,
                    help="未配对 CT/MR 的独立输出目录名(默认 <out-name>-ct);manifest 流集合一致性"
                         "要求融合帧与单流帧不能混在同一清单 → 必须分目录,字节不重复")
    ap.add_argument("--fusion-job-name", default=None, help="CT+PT 配对帧的融合 job 名")
    ap.add_argument("--ct-job-name", default=None, help="未配对 CT/MR 序列的单流 job 名")
    ap.add_argument("--modalities", default=",".join(VOLUME_MODALITIES))
    ap.add_argument("--min-slices", type=int, default=MIN_SLICES)
    ap.add_argument("--dry-run", action="store_true", help="只打印分组/配对/帧序,不写文件不建 job")
    args = ap.parse_args(argv)
    ct_out_name = args.ct_out_name or f"{args.out_name}-ct"

    modalities = tuple(m.strip().upper() for m in args.modalities.split(",") if m.strip())
    print(f"扫描 {args.input} ...")
    patients, n_files, n_dcm = scan_tree(args.input)
    print(f"文件 {n_files} 个, DICOM {n_dcm} 个, 患者 {len(patients)} 位")

    kept_by_study, skipped = {}, []
    for pid, studies in patients.items():
        for su, st in studies.items():
            for s_uid, series in st["series"].items():
                reason = series_reject_reason(series, modalities, args.min_slices)
                if reason:
                    skipped.append((series, reason))
                else:
                    series["study"] = st
                    kept_by_study.setdefault(su, {"meta": st["meta"], "series": {}})["series"][s_uid] = series

    pairs, unpaired_ct, unpaired_pet = pair_series(kept_by_study)
    frames = order_frames(pairs, unpaired_ct)
    report((patients, pairs, unpaired_ct, unpaired_pet), frames, skipped)
    if args.dry_run:
        print("\n[dry-run] 未写任何文件")
        return 0

    from yinghuo_app.biz.data_paths import shared_data_root
    shared = Path(shared_data_root())
    fusion_root, ct_root = shared / args.out_name, shared / ct_out_name
    assign_output_names([p["ct"] for p in pairs] + [p["pet"] for p in pairs], fusion_root)
    assign_output_names(unpaired_ct, ct_root)
    all_series = ([p["ct"] for p in pairs] + [p["pet"] for p in pairs] + unpaired_ct)

    print(f"\n装配 {len(all_series)} 个序列 → {fusion_root} (+{ct_root})")
    for s in all_series:
        img, warns = assemble_series(s)
        scale = None
        if s["meta"]["modality"] == "PT":
            scale, warn = suv_scale(s)
            if warn:
                print(f"  [warn] {s['out_name']}: {warn}")
        if s["out_path"].exists():
            print(f"  跳过已存在: {s['out_path'].name}")
        else:
            write_volume(img, s["out_path"], scale)
        for w in warns:
            print(f"  [warn] {s['out_name']}: {w}")

    entries_fusion = build_manifest_entries([f for f in frames if f["kind"] == "pair"])
    entries_ct = build_manifest_entries([f for f in frames if f["kind"] == "single"])

    for root, entries in ((fusion_root, entries_fusion), (ct_root, entries_ct)):
        if not entries:
            continue
        manifest_path = root / "_frames.json"
        manifest_path.write_text(json.dumps(
            {"schema_version": "1.0.0", "generator": "scripts/import_dicom.py",
             "frames": entries}, ensure_ascii=False, indent=1), "utf-8")
        print(f"帧清单: {manifest_path} ({len(entries)} 帧)")

    if args.fusion_job_name or args.ct_job_name:
        created = create_jobs([(args.out_name, args.fusion_job_name, entries_fusion),
                               (ct_out_name, args.ct_job_name, entries_ct)])
        print(f"建 job: {created}")
    else:
        print("未指定 job 名,只写数据")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
