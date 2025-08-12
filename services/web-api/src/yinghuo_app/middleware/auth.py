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
import time
import jwt
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from yinghuo_app.apps.ctx import CTX_USER_ID, CTX_USER_FRESHNESS
from yinghuo_conf import settings
from yinghuo_app.log import logger
from yinghuo_app.middleware.i18n import _

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.time()

        # Exclude paths that do not require authentication
        if request.url.path.startswith("/u/a/noau/"):
            response = await call_next(request)
            process_time = time.time() - start_time
            response.headers["X-Biz-Time"] = str(process_time)
            return response

        bearer_token = None
        header_token = request.headers.get('Authorization')
        if header_token and 'Bearer' in header_token:
            fields = header_token.split(' ')
            if len(fields) == 2:
                bearer_token = fields[1].strip()
        elif 'token' in request.query_params:
            bearer_token = request.query_params['token']

        user_id = None
        if bearer_token:
            try:
                decode_data = jwt.decode(bearer_token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                user_id = decode_data.get("user_id")
                CTX_USER_ID.set(int(user_id))

                freshness = request.headers.get('freshness')
                CTX_USER_FRESHNESS.set(int(freshness) if freshness else 0)
            except Exception as e:
                logger.error(f"decode jwt error, token: {bearer_token}, err: {e}")
                return Response(content=_("Unauthorized"), status_code=status.HTTP_401_UNAUTHORIZED)
        else:
            return Response(content=_("Unauthorized"), status_code=status.HTTP_401_UNAUTHORIZED)

        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Biz-Time"] = str(process_time)
        logger.info(f"user: {user_id}, host: {request.client.host}:{request.client.port}, path: {request.url.path}, method: {request.method}, process_time: {process_time}")
        return response