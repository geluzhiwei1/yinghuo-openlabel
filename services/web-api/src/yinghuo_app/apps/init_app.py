# Copyright (C) 2025 geluzhiwei.com
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
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
from yinghuo_conf import settings
from ..log import logger
from ..exceptions import BizException

from .anno_spec import app as anno_spec_app
from .user_depts import app as user_depts_app
from .user_roles import app as roles_app
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
from .user_resource import app as user_resource_app

def register_routers(app: FastAPI):
    # 登录后才能访问
    app.include_router(seq_app, prefix="/seq")
    app.include_router(files_app, prefix="/file2")
    app.include_router(file_app, prefix="/file")
    app.include_router(anno_spec_app, prefix="/anno_spec")
    app.include_router(user_depts_app, prefix="/depts")
    app.include_router(roles_app, prefix="/roles")
    app.include_router(label_app, prefix="/label")
    app.include_router(statistics_app, prefix="/statistics")
    app.include_router(job_perform_app, prefix="/anno-job")
    app.include_router(dnn_app, prefix="/dnn")
    # app.include_router(taxonomy_app, prefix="/taxonomy")
    app.include_router(openlabel, prefix="/openlabel")
    app.include_router(algo_app, prefix="/algo")
    app.include_router(system_app, prefix="/system")
    app.include_router(user_resource_app, prefix="/resource")
    
    # 无需登录即可访问
    app.include_router(auth_app, prefix="/u/a/noau")

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
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
            allow_methods=settings.CORS_ALLOW_METHODS,
            allow_headers=settings.CORS_ALLOW_HEADERS,
        ),
        # Middleware(
        #     HttpAuditLogMiddleware,
        #     methods=["GET", "POST", "PUT", "DELETE"],
        #     exclude_paths=[
        #         "/docs",
        #         "/openapi.json",
        #     ],
        # ),
    ]
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