"""_frames.json 帧清单契约 + find_stream_meta 显示名保留 + file2/get 路径解析优先级。"""
import json

import pytest

from yinghuo_app.dto.data_seq import SimpleDataSeq, load_frames_manifest
from yinghuo_app.exceptions import BizException

MANIFEST = {
    "schema_version": "1.0.0",
    "frames": [
        {
            "name": "P1 20211217 CT head", "patient": "P1", "patientName": "ANON",
            "studyDate": "20211217", "studyDesc": "PET/CT", "seriesDesc": "head",
            "modality": "CT", "pairedModality": "PT",
            "streams": {"ct": "ct/P1_20211217_head_ct.nrrd", "pet": "pet/P1_20211217_head_pt.nrrd"},
        },
        {
            "name": "P1 20211217 CT wb", "patient": "P1",
            "streams": {"ct": "ct/P1_20211217_wb_ct.nrrd", "pet": "pet/P1_20211217_wb_pt.nrrd"},
        },
    ],
}


def _make_seq(tmp_path, manifest=None, streams=("ct", "pet"), files=("ct/a.nrrd", "pet/b.nrrd")):
    root = tmp_path / "ds" / "med-x"
    for f in files:
        p = root / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x")
    if manifest is not None:
        (root / "_frames.json").write_text(json.dumps(manifest), "utf-8")
    return SimpleDataSeq(str(tmp_path / "ds"), "med-x", list(streams), [".nrrd"])


def test_manifest_defines_frames_and_copies_metadata(tmp_path):
    seq = _make_seq(tmp_path, MANIFEST)
    ct = seq.build_stream_meta("ct")["openlabel"]["frames"]
    pet = seq.build_stream_meta("pet")["openlabel"]["frames"]
    assert set(ct.keys()) == {"0", "1"} and set(pet.keys()) == {"0", "1"}
    # 配对结构性保证: 同一帧号在两流指向同一 manifest 条目
    assert ct["0"]["frame_properties"]["uri"] == "ct/P1_20211217_head_ct.nrrd"
    assert pet["0"]["frame_properties"]["uri"] == "pet/P1_20211217_head_pt.nrrd"
    props = ct["0"]["frame_properties"]
    for k in ("name", "patient", "patientName", "studyDate", "studyDesc",
              "seriesDesc", "modality", "pairedModality"):
        assert props[k] == MANIFEST["frames"][0][k]
    # 未提供的元数据键不落(帧 1 只有 name/patient/streams)
    assert "patientName" not in ct["1"]["frame_properties"]
    assert ct["1"]["frame_properties"]["timestamp"] == 1


def test_seq_meta_streams_from_manifest_union(tmp_path):
    seq = _make_seq(tmp_path, MANIFEST, streams=["ct", "pet"])
    meta, stream_metas, streams = seq.build_seq_meta()
    assert streams == ["ct", "pet"]
    assert set(meta["openlabel"]["streams"].keys()) == {"ct", "pet"}
    assert len(stream_metas) == 2
    # manifest 无需目录存在: 换成 manifest-only 流名也成立
    seq2 = _make_seq(tmp_path, MANIFEST, streams=["ct"], files=("ct/a.nrrd",))
    _, _, streams2 = seq2.build_seq_meta()
    assert streams2 == ["ct"]  # 声明过滤仍生效


def test_manifest_stream_set_mismatch_rejected(tmp_path):
    bad = {"frames": [
        {"streams": {"ct": "ct/a.nrrd", "pet": "pet/a.nrrd"}},
        {"streams": {"ct": "ct/b.nrrd"}},  # 融合 job 缺 pet → 帧数错位
    ]}
    with pytest.raises(BizException) as e:
        _make_seq(tmp_path, bad).build_seq_meta()
    assert "不一致" in e.value.statusText


@pytest.mark.parametrize("payload", [
    "{ not json", {"frames": []}, {"frames": "x"}, {"frames": [{"streams": {}}]}, {},
])
def test_malformed_manifest_rejected(tmp_path, payload):
    body = payload if isinstance(payload, str) else json.dumps(payload)
    root = tmp_path / "ds" / "med-x"
    root.mkdir(parents=True)
    (root / "_frames.json").write_text(body, "utf-8")
    with pytest.raises(BizException):
        load_frames_manifest(root)


def test_manifest_streams_no_intersection_with_declared(tmp_path):
    seq = _make_seq(tmp_path, MANIFEST, streams=["mr"])
    with pytest.raises(BizException):
        seq.build_seq_meta()


def test_legacy_rglob_path_unchanged(tmp_path):
    seq = _make_seq(tmp_path, manifest=None,
                    files=("ct/b.nrrd", "ct/a.nrrd", "pet/z.nrrd"))
    ct = seq.build_stream_meta("ct")["openlabel"]["frames"]
    assert list(ct.keys()) == ["0", "1"]
    assert ct["0"]["frame_properties"]["uri"] == "ct/a.nrrd"  # 排序后 a 在前
    assert "path" not in ct["0"]["frame_properties"]  # path 由 find_stream_meta 读时写


def test_find_stream_meta_preserves_display_name(monkeypatch):
    from yinghuo_app.biz.services import job_meta

    rows = [{"_id": "507f1f77bcf86cd799439011", "authority": {"owners": [4]},
             "datas": {"openlabel": {"metadata": {},
                                     "frames": {
                 "0": {"frame_properties": {"uri": "ct/a.nrrd", "name": "P1 head CT"}},
                 "1": {"frame_properties": {"uri": "ct/b.nrrd"}},
             }}}}]

    class Coll:
        @staticmethod
        def find(q):
            return iter(rows)

    monkeypatch.setattr(job_meta.Conf, "MG_DATA_STREAM_META", Coll)
    monkeypatch.setattr(job_meta, "file_uri_prefix",
                        lambda owner, seq: __import__("pathlib").Path(f"/file/{owner}/{seq}"))

    out = job_meta.find_stream_meta("507f1f77bcf86cd799439011", "ct", "serverLocalDir", seq="shared-datas/med-x")
    fps = out["openlabel"]["frames"]
    # manifest 帧: 显示名保留, path=相对路径, uri 重写为 URL 前缀
    assert fps["0"]["frame_properties"]["name"] == "P1 head CT"
    assert fps["0"]["frame_properties"]["path"] == "ct/a.nrrd"
    assert fps["0"]["frame_properties"]["uri"] == "/file/4/shared-datas/med-x/ct/a.nrrd"
    # legacy 帧: name 回退 uri(原行为), path 同样可用于解析
    assert fps["1"]["frame_properties"]["name"] == "ct/b.nrrd"
    assert fps["1"]["frame_properties"]["path"] == "ct/b.nrrd"
