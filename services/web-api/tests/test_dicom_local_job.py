"""build_meta_from 的 dicomLocal 分支: 帧元数据来自 label_spec.data.dicomFrames,uri 用 dicom:// 占位。"""
import pytest

from yinghuo_app.dto.data_seq import SimpleDataSeq
from yinghuo_app.exceptions import BizException


def job(dicom_frames, streams=("ct", "pet"), **extra):
    data = {"streams": list(streams), "imageURLs": [], "dicomLocal": True,
            "file_exts": [".dcm"], "dicomFrames": dicom_frames}
    data.update(extra)
    return {"label_spec": {"data": data}}


FRAMES = [
    {"name": "P1 20260101 CT HEAD", "patient": "P1", "patientName": "ANON",
     "studyDate": "20260101", "studyDesc": "PET/CT", "seriesDesc": "HEAD",
     "modality": "CT", "pairedModality": "PT",
     "streams": {"ct": "1.2.826.0.1.1", "pet": "1.2.826.0.1.2"}, "instanceCounts": {"ct": 47, "pet": 47}},
    {"name": "P1 20260101 CT WB", "patient": "P1", "studyDate": "20260101",
     "modality": "CT", "pairedModality": "PT",
     "streams": {"ct": "1.2.826.0.1.3", "pet": "1.2.826.0.1.4"}, "instanceCounts": {"ct": 263, "pet": 421}},
]


def test_dicom_local_frames_carry_metadata_and_dicom_uri():
    meta, stream_metas, streams = SimpleDataSeq.build_meta_from(job(FRAMES))
    assert streams == ["ct", "pet"]
    assert set(meta["openlabel"]["streams"].keys()) == {"ct", "pet"}
    ct = stream_metas[0]["openlabel"]["frames"]
    pet = stream_metas[1]["openlabel"]["frames"]
    assert list(ct.keys()) == ["0", "1"] and list(pet.keys()) == ["0", "1"]
    # 同一帧号两流指向同一 dicomFrames 条目(结构性配对保证)
    assert ct["0"]["frame_properties"]["uri"] == "dicom://1.2.826.0.1.1"
    assert pet["0"]["frame_properties"]["uri"] == "dicom://1.2.826.0.1.2"
    props = ct["0"]["frame_properties"]
    for k in ("name", "patient", "patientName", "studyDate", "studyDesc",
              "seriesDesc", "modality", "pairedModality"):
        assert props[k] == FRAMES[0][k]
    assert props["timestamp"] == 0
    # 帧缺的键不落
    assert "patientName" not in ct["1"]["frame_properties"]
    # instanceCounts 是表单侧信息,不进流 meta
    assert "instanceCounts" not in props


def test_dicom_local_single_stream_ct_only():
    frames = [{"name": "P2 nodate CT s3", "patient": "P2", "streams": {"ct": "uid-a"}}]
    meta, stream_metas, streams = SimpleDataSeq.build_meta_from(job(frames, streams=("ct",)))
    assert streams == ["ct"]
    assert stream_metas[0]["openlabel"]["frames"]["0"]["frame_properties"]["uri"] == "dicom://uid-a"


def test_dicom_local_single_ct_frames_sparse_pet():
    # 未配对 CT 帧只有 ct(合法): ct 流帧 0/1/2,pet 流按主数组索引稀疏对齐只出 0/1
    frames = [
        {"name": "P1 CT wb", "streams": {"ct": "uid-wb", "pet": "uid-wbp"}},
        {"name": "P1 CT head", "streams": {"ct": "uid-hd", "pet": "uid-hdp"}},
        {"name": "P1 CT lung", "streams": {"ct": "uid-lg"}},
    ]
    meta, stream_metas, streams = SimpleDataSeq.build_meta_from(job(frames))
    assert streams == ["ct", "pet"]
    ct = stream_metas[0]["openlabel"]["frames"]
    pet = stream_metas[1]["openlabel"]["frames"]
    assert list(ct.keys()) == ["0", "1", "2"]
    assert list(pet.keys()) == ["0", "1"]                       # 帧 2 无 pet,不落
    assert pet["0"]["frame_properties"]["uri"] == "dicom://uid-wbp"
    assert pet["1"]["frame_properties"]["uri"] == "dicom://uid-hdp"
    assert ct["2"]["frame_properties"]["name"] == "P1 CT lung"


@pytest.mark.parametrize("frames,streams,needle", [
    # 超出声明
    ([{"streams": {"ct": "a", "pet": "b"}}], ("ct",), "不在声明的 streams"),
    # 声明了 frames 里没有的流
    ([{"streams": {"ct": "a"}}], ("ct", "pet"), "不在 dicomFrames"),
])
def test_dicom_local_stream_set_validation(frames, streams, needle):
    with pytest.raises(BizException) as e:
        SimpleDataSeq.build_meta_from(job(frames, streams=streams))
    assert needle in e.value.statusText


@pytest.mark.parametrize("payload", [
    None, [], "x", [{"streams": {}}], [{}], [{"streams": {"ct": "  "}}],
])
def test_dicom_local_malformed_frames_rejected(payload):
    with pytest.raises(BizException):
        SimpleDataSeq.build_meta_from(job(payload))


def test_non_dicom_job_unchanged():
    # 非 dicomLocal 的旧路径不受影响(imageURLs 分组逻辑原样)
    data = {"streams": ["ct"], "imageURLs": ["x/ct/a.nrrd"]}
    _, stream_metas, streams = SimpleDataSeq.build_meta_from({"label_spec": {"data": data}})
    assert streams == ["ct"]
    assert "uri" in stream_metas[0]["openlabel"]["frames"]["0"]["frame_properties"]
