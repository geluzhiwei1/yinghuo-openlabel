import traceback

from fastapi import FastAPI
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, Response, HTTPException, status, Depends
from fastapi.responses import ORJSONResponse, JSONResponse

from yinghuo_app.exceptions import (
    DoesNotExist,
    HTTPException,
    IntegrityError,
    RequestValidationError,
    ResponseValidationError,
)
from yinghuo_app.config import settings
from ..log import logger
from ..exceptions import BizException

from .anno_spec import app as anno_spec_app
from .user_depts import app as user_depts_app
from .user_roles import app as roles_app
from .user_team import app as team_app
from .data_seq_app import app as seq_app
from .file_app import app as file_app
from .files_app import app as files_app
from .label_app import app as label_app
from .statistics_app import app as statistics_app
from .anno_job import app as job_perform_app
from .dnn_app import app as dnn_app
# from .taxonomy_app import app as taxonomy_app
from .openpgl_app import app as openlabel
from .algo_app import app as algo_app
from .system_app import app as system_app
from .auth import router as auth_app
from .orgs import router as orgs_app
from .projects import router as projects_app
from .project_templates import router as project_templates_app
from .taxonomies import router as taxonomies_app
from .workflows import router as workflows_app
from .flows import router as flows_app
from .quality import router as quality_app
from .labels import router as labels_app
from .batches import router as batches_app
from .me import router as me_app
from .exports import router as exports_app
from .data_seqs import router as data_seqs_app
from .audit import router as audit_app
from .notifications import router as notifications_app

# Stage 5 联调:把 admin/captcha/platform 三个独立 FastAPI app 的路由合并进主 app,
# 这样 uvicorn 单进程 8423 就能服务所有 /api/v1/{a,b,c,p}/* 前缀。
from ..admin.main import api_router as admin_api_router
from ..captcha.api import api_router as captcha_router
from ..captcha.email_code import api_router as email_code_router
from ..captcha.mobile_short_msg import api_router as mobile_short_msg_router

# 版本门控:ce < ee < saas
from ..edition import HAS_EE, HAS_SAAS

if HAS_EE:
    from ..ee.platform.auth import router as platform_auth_router
    from ..ee.platform.audit_route import router as platform_audit_router
    from ..ee.platform.audit_middleware import HttpAuditLogMiddleware
    from ..ee.platform.sso.oidc import router as sso_oidc_router
    from ..ee.platform.sso.ldap_login import router as sso_ldap_router
    from ..ee.platform.backup.routes import router as platform_backup_router
    EE_ROUTERS = [
        platform_auth_router,
        platform_audit_router,
        sso_oidc_router,
        sso_ldap_router,
        platform_backup_router,
    ]

if HAS_SAAS:
    from ..saas.platform.tenants import router as platform_tenants_router
    from ..saas.platform.users import router as platform_users_router
    from ..saas.platform.feature_flags import router as platform_feature_flags_router
    from ..saas.platform.flow import router as platform_flow_router
    from ..saas.platform.func import router as platform_func_router
    from ..saas.platform.models import router as platform_models_router
    from ..saas.platform.usage.middleware import QuotaMiddleware
    from ..saas.platform.billing.stripe_webhook import router as stripe_webhook_router
    from ..saas.platform.billing.routes import router as platform_billing_mgmt_router
    from ..saas.platform.signup.routes import router as platform_signup_router
    from ..saas.platform.ops_dashboard.routes import router as platform_ops_dashboard_router
    SAAS_ROUTERS = [
        platform_tenants_router, platform_users_router,
        platform_feature_flags_router, platform_flow_router,
        platform_func_router, platform_models_router,
        stripe_webhook_router, platform_billing_mgmt_router,
        platform_signup_router, platform_ops_dashboard_router,
    ]

def register_routers(app: FastAPI):
    # 登录后才能访问
    app.include_router(seq_app, prefix="/seq")
    app.include_router(files_app, prefix="/file2")
    app.include_router(file_app, prefix="/file")
    app.include_router(anno_spec_app, prefix="/anno_spec")
    app.include_router(user_depts_app, prefix="/depts")
    app.include_router(roles_app, prefix="/roles")
    app.include_router(team_app, prefix="/team")
    app.include_router(label_app, prefix="/label")
    app.include_router(statistics_app, prefix="/statistics")
    app.include_router(job_perform_app, prefix="/anno-job")
    app.include_router(dnn_app, prefix="/dnn")
    # app.include_router(taxonomy_app, prefix="/taxonomy")
    app.include_router(openlabel, prefix="/openlabel")
    app.include_router(algo_app, prefix="/algo")
    app.include_router(system_app, prefix="/system")
    # Stage 4 新增:租户感知的项目 / 标签集 路由
    app.include_router(projects_app, prefix="/projects")
    app.include_router(taxonomies_app, prefix="/taxonomies")
    # Stage 4 收尾:项目模板库
    app.include_router(project_templates_app, prefix="/project-templates")
    # Stage 5:审批工作流引擎
    app.include_router(workflows_app, prefix="/workflows")
    # DNN flow 只读列表(home/标注批次创建界面使用,CE edition 也开放)
    app.include_router(flows_app, prefix="/flows")
    # Stage 5 收尾:质量统计
    app.include_router(quality_app, prefix="/quality")
    # Stage 6:unit label 写入(对接工作流)
    app.include_router(labels_app, prefix="/labels")
    # Stage 7:Batch + Unit 调度(router 内含完整 path:/projects/{pid}/batches|units、/batches/{id}、/units/{id}/*)
    app.include_router(batches_app)
    # Stage 8:业务面剩余路由
    app.include_router(me_app, prefix="/me")
    app.include_router(exports_app, prefix="/exports")
    app.include_router(data_seqs_app, prefix="/data-seqs")
    # Stage 9.7:租户审计日志(管理面 AuditLog 视图)
    app.include_router(audit_app, prefix="/audit-logs")
    # Stage 12:实时通知(SSE + REST)
    app.include_router(notifications_app, prefix="/notifications")
    
    # 无需登录即可访问
    app.include_router(auth_app, prefix="/u/a/noau")

    # === admin/captcha/platform 路由合并(单进程 8423) ===
    # admin app 自己的 api_router 已经带 /api/v1/a 前缀,这里直接挂
    app.include_router(admin_api_router)
    # captcha 三个 router 原本挂在 /captcha /emailcode /mobilecode,这里加 /api/v1/c 外层前缀
    app.include_router(captcha_router, prefix="/api/v1/c")
    app.include_router(email_code_router, prefix="/api/v1/c")
    app.include_router(mobile_short_msg_router, prefix="/api/v1/c")
    # platform routers 原本在 platform/main.py 里挂在 /api/v1/p 下,这里同样处理。
    # ce edition 下不挂载,整段 /api/v1/p/* 直接 404。
    if HAS_EE:
        for r in EE_ROUTERS:
            app.include_router(r, prefix="/api/v1/p")
    if HAS_SAAS:
        for r in SAAS_ROUTERS:
            app.include_router(r, prefix="/api/v1/p")

async def all_exception_handler(request: Request, exc: Exception) -> Response:
    logger.exception(exc)
    logger.error("---------------")
    return JSONResponse(
        status_code=500,
        content={"message": "服务端程序异常"},
    )
def make_middlewares():
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
            allow_methods=settings.cors_methods_list,
            allow_headers=settings.cors_headers_list,
        ),
    ]
    if HAS_EE:
        # EE 增量:HTTP 全局审计中间件,记录所有 mutation 请求到业务 AuditLog。
        # fire-and-forget,不影响响应延迟。
        middleware.append(
            Middleware(HttpAuditLogMiddleware)
        )
    if HAS_SAAS:
        # SaaS 增量:按 tenant 维度 API 配额中间件,Redis pipeline + 本地缓存。
        middleware.append(
            Middleware(QuotaMiddleware)
        )
    return middleware


async def DoesNotExistHandle(req: Request, exc: DoesNotExist) -> JSONResponse:
    content = dict(
        status=404,
        statusText=f"Object has not found, exc: {exc}, query_params: {req.query_params}",
    )
    return JSONResponse(content=content, status_code=404)


async def IntegrityHandle(_: Request, exc: IntegrityError) -> JSONResponse:
    content = dict(
        status=500,
        statusText=f"IntegrityError，{exc}",
    )
    logger.error(exc)
    traceback.print_exception(exc)
    return JSONResponse(content=content, status_code=500)


async def HttpExcHandle(_: Request, exc: HTTPException) -> JSONResponse:
    logger.error(exc)
    traceback.print_exception(exc)
    content = dict(status=exc.status_code, statusText=exc.detail, data=None)
    return JSONResponse(content=content, status_code=exc.status_code)


async def RequestValidationHandle(_: Request, exc: RequestValidationError) -> JSONResponse:
    logger.error(exc)
    traceback.print_exception(exc)
    content = dict(status=422, statusText=f"RequestValidationError, {exc}")
    return JSONResponse(content=content, status_code=422)


async def ResponseValidationHandle(_: Request, exc: ResponseValidationError) -> JSONResponse:
    logger.error(exc)
    traceback.print_exception(exc)
    content = dict(status=500, statusText=f"ResponseValidationError, {exc}")
    return JSONResponse(content=content, status_code=500)

async def BizException_handler(request: Request, exc: BizException) -> Response:
    logger.error(exc)
    traceback.print_exception(exc)
    return JSONResponse(
        content={"status": exc.status, "statusText": exc.statusText},
    )
    
def register_exceptions(app: FastAPI):
    app.add_exception_handler(DoesNotExist, DoesNotExistHandle)
    app.add_exception_handler(HTTPException, HttpExcHandle)
    app.add_exception_handler(IntegrityError, IntegrityHandle)
    app.add_exception_handler(RequestValidationError, RequestValidationHandle)
    app.add_exception_handler(ResponseValidationError, ResponseValidationHandle)
    app.add_exception_handler(BizException, BizException_handler)
    app.add_exception_handler(Exception, all_exception_handler)