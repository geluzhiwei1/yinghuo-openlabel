"""volumeSegment3d 导出辅助: merge_series_nifti(每序列多段合并)/_series_zip_name。"""
import gzip

import numpy as np
import pytest

from yinghuo_app.biz.services.anno import (
    _series_uid_meta, _series_zip_name, grids_equal, merge_series_nifti,
    parse_series_nifti, parse_series_nrrd, read_frame_grid,
)


def _write_mask(path, sizes, voxel_indices, spacing=(1.0, 1.0, 1.0),
                origin=(0.0, 0.0, 0.0)):
    """写一个与线上 anno_masks 同构的单标签 .seg.nrrd.gz(uint16 raw, gzip 整文件)。"""
    arr = np.zeros(sizes[0] * sizes[1] * sizes[2], dtype="<u2")
    arr[list(voxel_indices)] = 1
    header = (
        "NRRD0005\n"
        "type: uint16\n"
        "dimension: 3\n"
        "space: right-anterior-superior\n"
        f"sizes: {sizes[0]} {sizes[1]} {sizes[2]}\n"
        f"space directions: ({spacing[0]},0,0) (0,{spacing[1]},0) (0,0,{spacing[2]})\n"
        "kinds: domain domain domain\n"
        f"space origin: ({origin[0]},{origin[1]},{origin[2]})\n"
        "endian: little\n"
        "encoding: raw\n"
        'labels: "1=Segment 1"\n'
        "\n"
    )
    path.write_bytes(gzip.compress(header.encode() + arr.tobytes(), mtime=0))


def test_merge_series_two_segments(tmp_path):
    a = tmp_path / "a.seg.nrrd.gz"
    _write_mask(a, (4, 5, 6), [0, 7, 13], spacing=(0.5, 0.5, 1.5),
                origin=(-249.02318200000002, -249.02318200000002, -1307.99))
    b = tmp_path / "b.seg.nrrd.gz"
    _write_mask(b, (4, 5, 6), [7, 100], spacing=(0.5, 0.5, 1.5),
                origin=(-249.02318200000002, -249.02318200000002, -1307.99))  # 7 与 a 重叠

    blob = merge_series_nifti([str(a), str(b)], [1, 2])
    assert blob[:2] == b"\x1f\x8b"  # gzip 容器

    p = tmp_path / "merged.nii.gz"
    p.write_bytes(blob)
    parsed = parse_series_nifti(str(p))
    assert parsed["sizes"] == (4, 5, 6)
    assert parsed["spacing"] == [0.5, 0.5, 1.5]
    # NIfTI float32 往返后 RAS origin 与 mask 头一致(网格按容差判等)
    assert grids_equal((parsed["sizes"], parsed["spacing"], parsed["origin"]),
                       ((4, 5, 6), [0.5, 0.5, 1.5],
                        [-249.02318200000002, -249.02318200000002, -1307.99]))
    assert parsed["segments"] == [(1, "Label 1"), (2, "Label 2")]
    # labels 是 [z,y,x] 三维数组; C 序展平 == mask 的 NRRD x-最快平铺序
    flat = parsed["labels"].reshape(-1)
    assert flat.size == 120
    assert flat[0] == 1 and flat[13] == 1
    assert flat[100] == 2
    assert flat[7] == 2  # 重叠: 后段覆盖
    assert int((flat == 0).sum()) == 120 - 4


def test_merge_series_grid_mismatch(tmp_path):
    a = tmp_path / "a.seg.nrrd.gz"
    _write_mask(a, (4, 5, 6), [1])
    b = tmp_path / "b.seg.nrrd.gz"
    _write_mask(b, (4, 5, 7), [1])
    with pytest.raises(ValueError):
        merge_series_nifti([str(a), str(b)], [1, 2])


def test_series_zip_name():
    frames = [
        {"name": "P000070439 20211019 CT HEAD/CT 1.25mm"},
        {"name": "肝脏序列"},
    ]
    assert _series_zip_name(frames, "0") == \
        "series/000_P000070439_20211019_CT_HEAD_CT_1.25mm.nii.gz"
    assert _series_zip_name(frames, "1") == "series/001_肝脏序列.nii.gz"
    # 帧号越界/无 dicomFrames → 回退 series_{frame}
    assert _series_zip_name([], "3") == "series/series_3.nii.gz"


def test_series_uid_meta():
    frames = [
        {"patient": "P000070439", "studyUid": "1.2.3", "seriesUid": "1.2.3.5"},
        {"name": "无元数据帧"},
    ]
    assert _series_uid_meta(frames, "0") == \
        {"patient": "P000070439", "study_uid": "1.2.3", "series_uid": "1.2.3.5"}
    assert _series_uid_meta(frames, "1") == {}
    assert _series_uid_meta(frames, "x") == {}
    assert _series_uid_meta([], "0") == {}


def _write_multi_seg_nrrd(path, sizes, segs, origin=(0, 0, 0)):
    """手工多标签 series .seg.nrrd.gz(旧版导出格式, 回导兼容用)。segs: [(label, name, voxels)]"""
    arr = np.zeros(sizes[0] * sizes[1] * sizes[2], dtype="<u2")
    for label, _name, voxels in segs:
        arr[list(voxels)] = label
    lines = [
        "NRRD0005", "type: uint16", "dimension: 3",
        "space: right-anterior-superior",
        f"sizes: {sizes[0]} {sizes[1]} {sizes[2]}",
        "space directions: (1,0,0) (0,1,0) (0,0,1)",
        "kinds: domain domain domain",
        f"space origin: ({origin[0]},{origin[1]},{origin[2]})",
        "endian: little", "encoding: raw",
        "patient := P1", "series_uid := 1.2.840.3",
    ]
    for i, (label, name, _v) in enumerate(segs):
        lines.append(f"Segment{i}_LabelValue := {label}")
        lines.append(f"Segment{i}_Name := {name}")
    path.write_bytes(gzip.compress(
        ("\n".join(lines) + "\n\n").encode() + arr.tobytes(), mtime=0))


def test_parse_series_nrrd_roundtrip(tmp_path):
    """旧版导出的 series .seg.nrrd.gz → parse_series_nrrd(回导兼容)。"""
    merged = tmp_path / "series.seg.nrrd.gz"
    _write_multi_seg_nrrd(merged, (4, 5, 6), [(1, "Liver", [0, 7]), (2, "Tumor", [100])])

    parsed = parse_series_nrrd(str(merged))
    assert parsed["sizes"] == (4, 5, 6)
    assert parsed["spacing"] == [1.0, 1.0, 1.0]
    assert parsed["origin"] == [0.0, 0.0, 0.0]
    assert parsed["segments"] == [(1, "Liver"), (2, "Tumor")]
    assert parsed["fields"]["patient"] == "P1"
    assert parsed["fields"]["series_uid"] == "1.2.840.3"
    assert len(parsed["labels"]) == 120
    assert (parsed["labels"] == 1).sum() == 2 and (parsed["labels"] == 2).sum() == 1
    assert any(l.startswith("space origin") for l in parsed["geo"])


def test_read_frame_grid_and_equal(tmp_path):
    p = tmp_path / "frame.nrrd.gz"
    _write_mask(p, (4, 5, 6), [1])
    g = read_frame_grid(str(p))
    assert g is not None
    assert grids_equal(g, ((4, 5, 6), [1.0, 1.0, 1.0], [0.0, 0.0, 0.0]))
    assert not grids_equal(g, ((4, 5, 7), [1.0, 1.0, 1.0], [0.0, 0.0, 0.0]))
    assert not grids_equal(None, g)
    assert read_frame_grid(str(tmp_path / "nope.nrrd")) is None
    # float32 半 ulp 漂移不误判(|o|~1300mm → ~6e-5 < 1e-3 容差)
    assert grids_equal(((4, 5, 6), [1.0, 1.0, 3.269999999999999],
                        [-249.02318200000002, -249.02317810058594, -1307.989990234375]),
                       ((4, 5, 6), [1.0, 1.0, 3.27], [-249.02318, -249.02318, -1307.99]))


def test_parse_series_nrrd_rejects_bad(tmp_path):
    p = tmp_path / "bad.gz"
    p.write_bytes(b"\x1f\x8b" + b"garbage")  # 非 gzip
    with open(p, "wb") as f:
        import gzip as _g
        f.write(_g.compress(b"not nrrd at all\n\nXX"))
    with pytest.raises(ValueError):
        parse_series_nrrd(str(p))


# ── NIfTI 导入辅助 ────────────────────────────────────────────────────

def _write_nifti(path, arr_xyz, spacing=(1.0, 1.0, 1.0), origin_lps=(0.0, 0.0, 0.0),
                 direction=None):
    """arr_xyz: [x,y,z] 索引序(与 sitk 的 index 对齐);写 .nii.gz。"""
    import SimpleITK as sitk
    img = sitk.GetImageFromArray(np.transpose(arr_xyz, (2, 1, 0)).copy())
    img.SetSpacing(tuple(float(v) for v in spacing))
    img.SetOrigin(tuple(float(v) for v in origin_lps))
    if direction:
        img.SetDirection(direction)
    sitk.WriteImage(img, str(path))


def test_parse_series_nifti_identity(tmp_path):
    arr = np.zeros((4, 5, 6), dtype=np.uint16)   # [x, y, z]
    arr[1, 2, 3] = 1
    arr[0, 0, 0] = 2
    p = tmp_path / "P001.nii.gz"
    _write_nifti(p, arr, spacing=(1.0, 2.0, 3.0), origin_lps=(10.0, 20.0, 30.0))

    parsed = parse_series_nifti(str(p))
    assert parsed["sizes"] == (4, 5, 6)
    assert parsed["spacing"] == [1.0, 2.0, 3.0]
    # identity LPS → RAS 翻轴后起点角重锚: -o[i]-spacing[i]*(n[i]-1)
    assert parsed["origin"] == [-13.0, -28.0, 30.0]
    assert parsed["segments"] == [(1, "Label 1"), (2, "Label 2")]
    ras = parsed["labels"].reshape(6, 5, 4)      # [z, y, x]
    # RAS = LPS 的 x,y 翻转: arr[1,2,3]→ras[3, 2, 2]; arr[0,0,0]→ras[0, 4, 3]
    assert ras[3, 2, 2] == 1 and ras[0, 4, 3] == 2
    lps_cand = parsed["candidates"][1]
    assert lps_cand[0] == "left-posterior-superior"
    assert lps_cand[1] == [10.0, 20.0, 30.0]
    assert np.array_equal(lps_cand[2].reshape(6, 5, 4),
                          ras[:, ::-1, ::-1])


def test_parse_series_nifti_negative_direction(tmp_path):
    arr = np.zeros((4, 5, 6), dtype=np.uint16)   # [x, y, z]
    arr[0, 0, 0] = 1
    p = tmp_path / "seg.nii"
    # direction = diag(-1, -1, 1): x,y 轴指向 LPS 反方向
    _write_nifti(p, arr, spacing=(1.0, 1.0, 2.0), origin_lps=(3.0, 4.0, 5.0),
                 direction=(-1, 0, 0, 0, -1, 0, 0, 0, 1))

    parsed = parse_series_nifti(str(p))
    # 翻正后 LPS origin: x=3-(4-1)=0, y=4-(5-1)=0
    lps = parsed["candidates"][1]
    assert lps[1] == [0.0, 0.0, 5.0]
    # 原 arr[0,0,0](x 负向端)翻正后在 x=3, y=4
    lps_arr = lps[2].reshape(6, 5, 4)
    assert lps_arr[0, 4, 3] == 1
    # RAS 候选 origin 重锚: x=-0-1*(4-1)=-3, y=-0-1*(5-1)=-4
    assert parsed["origin"] == [-3.0, -4.0, 5.0]


def test_parse_series_nifti_rejects(tmp_path):
    # 4D
    import SimpleITK as sitk
    img = sitk.Image([3, 3, 3, 2], sitk.sitkUInt16)
    p4 = tmp_path / "four_d.nii.gz"
    sitk.WriteImage(img, str(p4))
    with pytest.raises(ValueError, match="3D"):
        parse_series_nifti(str(p4))
    # 概率图(非整数)
    imgf = sitk.GetImageFromArray(np.full((3, 3, 3), 0.5, dtype=np.float32))
    pf = tmp_path / "prob.nii.gz"
    sitk.WriteImage(imgf, str(pf))
    with pytest.raises(ValueError, match="整数"):
        parse_series_nifti(str(pf))
    # 斜置方向
    arr = np.zeros((3, 3, 3), dtype=np.uint16)
    arr[1, 1, 1] = 1
    po = tmp_path / "oblique.nii.gz"
    _write_nifti(po, arr, direction=(0.7071, 0.7071, 0, -0.7071, 0.7071, 0, 0, 0, 1))
    with pytest.raises(ValueError, match="斜置"):
        parse_series_nifti(str(po))
    # 非分割(全零)
    pz = tmp_path / "empty.nii.gz"
    _write_nifti(pz, np.zeros((3, 3, 3), dtype=np.uint16))
    with pytest.raises(ValueError, match="非零标签"):
        parse_series_nifti(str(pz))
