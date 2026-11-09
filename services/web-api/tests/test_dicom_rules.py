"""import_dicom 纯规则函数: 与前端 dicomGroup.ts 同规范的镜像用例(契约二)。"""
import pytest

from scripts.import_dicom import (
    MIN_SLICES,
    frame_display_name,
    is_localizer,
    order_frames,
    output_name,
    pair_series,
    projection,
    sanitize_name,
    series_reject_reason,
    slice_normal,
    sort_instances,
    z_spacing,
)


def inst(**kw):
    """合成实例标签 dict;轴向单位方向为默认。"""
    d = {
        "path": "", "patient_id": "P1", "patient_name": "", "study_uid": "S1",
        "study_date": "20260101", "study_desc": "", "series_uid": "SE1",
        "series_number": 1, "series_desc": "", "modality": "CT",
        "image_type": ["ORIGINAL", "PRIMARY"], "iop": [1, 0, 0, 0, 1, 0],
        "ipp": [0, 0, 0], "pixel_spacing": [1.0, 1.0], "rows": 4, "cols": 4,
        "for_uid": "F1", "units": "", "decay_correction": "", "weight_kg": 0,
        "dose_bq": None, "number_of_frames": 1, "transfer_syntax": "",
        "slice_thickness": 1.0,
    }
    d.update(kw)
    return d


def series(uid, instances, **meta):
    m = {"uid": uid, "series_number": 1, "series_desc": "", "modality": "CT",
         "for_uid": "F1", "patient_id": "P1", "study_date": "20260101"}
    m.update(meta)
    return {"meta": m, "instances": instances}


# ── 排序/法向(规则 2) ────────────────────────────────────────────────────

def test_sort_by_projection_not_instance_number():
    # InstanceNumber 乱序,IPP z = 5,0,10 → 投影升序
    items = [inst(ipp=[0, 0, 5.0]), inst(ipp=[0, 0, 0.0]), inst(ipp=[0, 0, 10.0])]
    out, dropped = sort_instances(items)
    assert [i["ipp"][2] for i in out] == [0.0, 5.0, 10.0]
    assert dropped == 0


def test_sort_drops_duplicate_projections():
    items = [inst(ipp=[0, 0, 0.0]), inst(ipp=[0, 0, 0.0]), inst(ipp=[0, 0, 1.0])]
    out, dropped = sort_instances(items)
    assert len(out) == 2 and dropped == 1


def test_oblique_slice_normal():
    # IOP 行=(1,0,0), 列=(0,1,0) → 法向 (0,0,1);旋转 90° 绕 z: 行=(0,1,0), 列=(-1,0,0) → 法向仍 (0,0,1)
    assert slice_normal([1, 0, 0, 0, 1, 0]) == pytest.approx((0, 0, 1))
    assert slice_normal([0, 1, 0, -1, 0, 0]) == pytest.approx((0, 0, 1))
    # 矢状位: 行=(0,0,-1)? 用可验证组合: 行=(0,1,0),列=(0,0,1) → 法向 (1,0,0)
    assert slice_normal([0, 1, 0, 0, 0, 1]) == pytest.approx((1, 0, 0))
    # 投影沿新法向
    p = projection(inst(iop=[0, 1, 0, 0, 0, 1], ipp=[3.5, 7, 9]))
    assert p == pytest.approx(3.5)


def test_z_spacing_uniformity():
    good = [inst(ipp=[0, 0, z * 1.25]) for z in range(12)]
    mean, uniform = z_spacing(good)
    assert mean == pytest.approx(1.25) and uniform
    bad = good + [inst(ipp=[0, 0, 12 * 1.25 + 0.5])]
    _, uniform2 = z_spacing(bad)
    assert not uniform2


# ── 体序列过滤(规则 3) ────────────────────────────────────────────────────

def test_filter_localizer_min_slices_modalities_multiframe():
    ok = series("SE1", [inst() for _ in range(MIN_SLICES)])
    assert series_reject_reason(ok) is None
    assert "localizer" in series_reject_reason(
        series("SE2", [inst(image_type=["LOCALIZER"]) for _ in range(MIN_SLICES)]))
    assert "切片数" in series_reject_reason(series("SE3", [inst() for _ in range(3)]))
    assert "多帧" in series_reject_reason(
        series("SE4", [inst(number_of_frames=200)] + [inst() for _ in range(MIN_SLICES - 1)]))
    assert "modality" in series_reject_reason(
        series("SE5", [inst(modality="SR") for _ in range(MIN_SLICES)], modality="SR"))
    assert "行/列" in series_reject_reason(
        series("SE6", [inst()] + [inst(rows=8) for _ in range(MIN_SLICES - 1)]))


# ── 配对(规则 4) ─────────────────────────────────────────────────────────

def _pair_setup():
    # head CT(F1) / wb CT(F2) / head PT(F1) / wb PT(F2) 同一 study
    n = MIN_SLICES
    head_ct = series("CT-HEAD", [inst(for_uid="F1") for _ in range(n)],
                     series_number=2, series_desc="HEAD", for_uid="F1")
    wb_ct = series("CT-WB", [inst(for_uid="F2") for _ in range(n + 50)],
                   series_number=4, series_desc="WB", for_uid="F2")
    head_pt = series("PT-HEAD", [inst(for_uid="F1", modality="PT") for _ in range(n)],
                     series_number=3, series_desc="PET HEAD", for_uid="F1", modality="PT")
    wb_pt = series("PT-WB", [inst(for_uid="F2", modality="PT") for _ in range(n)],
                   series_number=5, series_desc="PET WB", for_uid="F2", modality="PT")
    study = {"meta": {"patient_id": "P1", "study_uid": "S1",
                      "study_date": "20260101", "study_desc": ""},
             "series": {s["meta"]["uid"]: s for s in (head_ct, wb_ct, head_pt, wb_pt)}}
    return {"S1": study}, (head_ct, wb_ct, head_pt, wb_pt)


def test_pair_by_frame_of_reference():
    studies, (head_ct, wb_ct, head_pt, wb_pt) = _pair_setup()
    pairs, unpaired_ct, unpaired_pet = pair_series(studies)
    assert len(pairs) == 2 and not unpaired_ct and not unpaired_pet
    by_pet = {p["pet"]["meta"]["uid"]: p["ct"]["meta"]["uid"] for p in pairs}
    assert by_pet["PT-HEAD"] == "CT-HEAD"  # head PT 配 head CT,绝不盲配
    assert by_pet["PT-WB"] == "CT-WB"


def _zseries(uid, z0, dz, n, **meta):
    return series(uid, [inst(for_uid=meta.get("for_uid", "F1"), ipp=[0, 0, z0 + i * dz])
                        for i in range(n)], **meta)


def test_pair_prefers_matching_z_extent_over_slice_count():
    # 真实 GE 场景镜像: head PET 的 FoR 同时匹配 head CT 与 lung recon(切片更多)
    head_ct = _zseries("CT-HEAD", 0, 3.27, 47, series_number=2, for_uid="F1")
    lung_ct = _zseries("CT-LUNG", 0, 1.25, 225, series_number=3, for_uid="F1")
    head_pt = _zseries("PT-HEAD", 0, 3.27, 47, series_number=4, for_uid="F1", modality="PT")
    study = {"meta": {"patient_id": "P1", "study_uid": "S", "study_date": "d", "study_desc": ""},
             "series": {s["meta"]["uid"]: s for s in (head_ct, lung_ct, head_pt)}}
    pairs, unpaired_ct, _ = pair_series({"S": study})
    # head PET 跨度 152mm ≈ head CT,远小于 lung 281mm → 配 head CT 而非切片更多的 lung
    assert pairs[0]["ct"]["meta"]["uid"] == "CT-HEAD"
    assert [c["meta"]["uid"] for c in unpaired_ct] == ["CT-LUNG"]


def test_pair_tie_breaks():
    n = MIN_SLICES
    # 同 FoR 同跨度: 切片数相同 → SeriesNumber 差小者胜
    ct_a = series("CT-A", [inst(for_uid="F1") for _ in range(n)], series_number=10, for_uid="F1")
    ct_b = series("CT-B", [inst(for_uid="F1") for _ in range(n)], series_number=20, for_uid="F1")
    pt = series("PT-X", [inst(for_uid="F1", modality="PT") for _ in range(n)],
                series_number=12, for_uid="F1", modality="PT")
    study = {"meta": {"patient_id": "P1", "study_uid": "S", "study_date": "d", "study_desc": ""},
             "series": {s["meta"]["uid"]: s for s in (ct_a, ct_b, pt)}}
    pairs, unpaired_ct, _ = pair_series({"S": study})
    assert pairs[0]["ct"]["meta"]["uid"] == "CT-A"
    assert [c["meta"]["uid"] for c in unpaired_ct] == ["CT-B"]
    # 跨度平手 → 切片更密(更多)者胜
    ct_dense = _zseries("CT-DENSE", 0, 0.5, 21, series_number=99, for_uid="F1")
    pt2 = _zseries("PT-Y", 0, 1.0, 11, series_number=13, for_uid="F1", modality="PT")
    study2 = {"meta": study["meta"],
              "series": {s["meta"]["uid"]: s for s in (ct_a, ct_dense, pt2)}}
    pairs2, _, _ = pair_series({"S": study2})
    assert pairs2[0]["ct"]["meta"]["uid"] == "CT-DENSE"


def test_unpaired_pet_no_blind_fallback():
    n = MIN_SLICES
    ct = series("CT-ONLY", [inst(for_uid="F1") for _ in range(n)], for_uid="F1")
    pt = series("PT-NOFOR", [inst(for_uid="", modality="PT") for _ in range(n)],
                for_uid="", modality="PT")
    study = {"meta": {"patient_id": "P1", "study_uid": "S", "study_date": "d", "study_desc": ""},
             "series": {"CT-ONLY": ct, "PT-NOFOR": pt}}
    pairs, unpaired_ct, unpaired_pet = pair_series({"S": study})
    assert pairs == [] and len(unpaired_ct) == 1 and len(unpaired_pet) == 1


# ── 帧序(规则 5)与命名(规则 6) ───────────────────────────────────────────

def test_frame_order_patient_date_and_series():
    def st(pid, date):
        return {"meta": {"patient_id": pid, "study_uid": f"S-{pid}-{date or 'x'}",
                         "study_date": date, "study_desc": ""}, "series": {}}

    def pair(ct_num, pet_num, study):
        return {"study": study,
                "ct": series(f"CT{ct_num}", [], series_number=ct_num),
                "pet": series(f"PT{pet_num}", [], series_number=pet_num, modality="PT")}

    def single(num, study):
        s = series(f"S{num}", [], series_number=num)
        s["study"] = study  # 生产代码在配对前给序列挂 study(见 main)
        return s

    s_b = st("B", "20260101")
    s_a2 = st("A", "20260601")   # A 的晚检查
    s_a1 = st("A", "20260201")   # A 的早检查
    s_nodate = st("A", "")       # A 的无日期检查 → 排 A 组最后
    pairs = [pair(90, 9, s_b), pair(99, 9, s_a2), pair(70, 7, s_a1), pair(20, 2, s_nodate)]
    unpaired = [single(3, s_a1), single(1, s_nodate)]
    out = order_frames(pairs, unpaired)
    keys = [(f["study"]["meta"]["patient_id"], f["study"]["meta"]["study_date"], f["kind"], f["order"][0])
            for f in out]
    assert keys == [
        ("A", "20260201", "pair", 7),      # A 早检查: 配对帧
        ("A", "20260201", "single", 3),    #   然后未配对
        ("A", "20260601", "pair", 9),      # A 晚检查
        ("A", "", "pair", 2),              # A 无日期检查排尾,其内配对在前
        ("A", "", "single", 1),
        ("B", "20260101", "pair", 9),      # B
    ]


def test_naming():
    assert sanitize_name("WB CT / 3.75mm") == "WB_CT_3_75mm"  # '.' 非白名单字符 → '_'(规范 6)
    assert output_name({"patient_id": "P0001", "study_date": "20211217",
                        "series_desc": "Head CT", "series_number": 7}) == "P0001_20211217_Head_CT"
    assert output_name({"patient_id": "P0001", "study_date": "",
                        "series_desc": "", "series_number": 12}) == "P0001_nodate_s12"
    assert frame_display_name("P1", "20211217", "CT", "wb", 4) == "P1 20211217 CT wb"
    assert frame_display_name("P1", "", "PT", "", 8) == "P1 nodate PT s8"
