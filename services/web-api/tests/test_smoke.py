"""最小冒烟测试:确认 FastAPI app 能在当前 YH_EDITION 下正确装配。
不连接外部服务(lifespan 未触发),只覆盖 router 注册阶段。
"""
import os
import pytest


def _route_paths(app) -> set:
    paths = set()

    def collect(routes):
        for r in routes:
            # fastapi>=0.141 include_router 包装成 _IncludedRouter(无 .path/.routes),
            # 真实路径在 effective_candidates() 里(带 include prefix)
            if hasattr(r, "effective_candidates"):
                collect(r.effective_candidates())
            elif hasattr(r, "original_router"):
                collect(r.original_router.routes)
            elif hasattr(r, "routes"):
                collect(r.routes)
            if getattr(r, "path", ""):
                paths.add(r.path)

    collect(app.routes)
    return paths


def test_app_assembles_under_current_edition():
    """三档 edition 下 app 都应当能装配;此处只断言业务面路由始终存在。"""
    from yinghuo_app.app import app

    paths = _route_paths(app)
    assert any(p.startswith("/workflows") for p in paths), "business /workflows missing"
    assert any(p.startswith("/flows") for p in paths), "business /flows (CE) missing"
    assert len(app.routes) > 0


@pytest.mark.ce
def test_ce_routes_absent_when_ce():
    """CE edition 不应挂载任何 /api/v1/p/* 平台路由。CI 矩阵的 ce job 跑此项。"""
    if os.getenv("YH_EDITION", "ce") != "ce":
        pytest.skip("only applicable to CE edition")
    from yinghuo_app.app import app

    paths = _route_paths(app)
    assert not any(p.startswith("/api/v1/p/") for p in paths), \
        "CE should not mount any /api/v1/p/* routes"


@pytest.mark.ee
def test_ee_routes_partial_when_ee():
    """EE edition 应挂载平台账号 + 审计查询路由,但不应有租户/计费等 SaaS 路由。

    EE 留:auth, audit_route(PlatformAuthControl + 审计查询)
    SaaS 迁走:tenants, users, feature_flags, flow, func, models
    """
    if os.getenv("YH_EDITION", "ce") != "ee":
        pytest.skip("only applicable to EE edition")
    from yinghuo_app.app import app

    paths = _route_paths(app)
    # EE 应该有平台登录入口
    assert any("/api/v1/p/" in p and "auth" in p for p in paths), \
        "EE should mount /api/v1/p/auth/*"
    # EE 不应该有租户 CRUD
    assert not any(p.startswith("/api/v1/p/tenants") for p in paths), \
        "EE should NOT mount /api/v1/p/tenants (SaaS-only)"


@pytest.mark.saas
def test_saas_routes_full_when_saas():
    """SaaS edition 应挂载全部平台路由(EE 基础设施 + SaaS 多租户运营)。"""
    if os.getenv("YH_EDITION", "ce") != "saas":
        pytest.skip("only applicable to SaaS edition")
    from yinghuo_app.app import app

    paths = _route_paths(app)
    # SaaS 应该有租户 CRUD
    assert any(p.startswith("/api/v1/p/tenants") for p in paths), \
        "SaaS should mount /api/v1/p/tenants"
    # SaaS 也应该继承 EE 的平台登录
    assert any("/api/v1/p/" in p and "auth" in p for p in paths), \
        "SaaS should also mount /api/v1/p/auth/* (inherited from EE)"
