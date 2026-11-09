"""volume_infer(体数据模型推理代理)冒烟: 路由注册 + 纯辅助函数, 不依赖 med-seg 服务。"""
import pytest

from tests.test_smoke import _route_paths


def test_volume_infer_routes_registered():
    """四个 volume_infer 路由应挂在 label 前缀下。"""
    from yinghuo_app.app import app

    paths = _route_paths(app)
    for p in ("/label/volume_infer/models", "/label/volume_infer",
              "/label/volume_infer/{task_id}", "/label/volume_infer/{task_id}/mask"):
        assert p in paths, f"route missing: {p}"


def test_med_seg_base_reads_gconf():
    """dev 配置里 infer.med_seg.url 应被解析为去尾斜杠的 base。"""
    from yinghuo_app.apps.label_app import _med_seg_base
    import yinghuo_conf.config as yconf

    gconf = yconf.gConf
    url = (((gconf.kvs.get("infer") or {}).get("med_seg") or {}).get("url") or "").strip()
    if not url:
        pytest.skip("config has no infer.med_seg.url")
    assert _med_seg_base() == url.rstrip("/")


def test_infer_model_requires_covers_both_models():
    from yinghuo_app.apps.label_app import _INFER_MODEL_REQUIRES

    assert _INFER_MODEL_REQUIRES["total-segmentator"] == ["ct"]
    assert _INFER_MODEL_REQUIRES["autopet"] == ["ct", "pet"]


def test_pre_annotate_hook_guards():
    """_start_volume_pre_annotate: 非体数据任务/未勾模型 → 直接返回(不抛不建任务)。"""
    from yinghuo_app.apps.anno_job import _start_volume_pre_annotate
    from yinghuo_app.biz.db.collection import AnnoJob

    other = AnnoJob(label_spec={"domain": {"key": "d"}, "mission": {"key": "objectBBox2d"},
                                "taxonomy": {"key": "t"},
                                "data": {"pre_annotate": ["total-segmentator"]}})
    _start_volume_pre_annotate(other, "x")  # 非体数据 → no-op

    empty = AnnoJob(label_spec={"domain": {"key": "d"}, "mission": {"key": "volumeSegment3d"},
                                "taxonomy": {"key": "t"}, "data": {"pre_annotate": []}})
    _start_volume_pre_annotate(empty, "x")  # 未勾模型 → no-op
