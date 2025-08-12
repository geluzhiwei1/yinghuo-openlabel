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
from typing import Any, Optional

from fastapi.responses import JSONResponse


class SuccessJson(JSONResponse):
    def __init__(
        self,
        status: int = 200,
        statusText: Optional[str] = "OK",
        data: Optional[Any] = None,
        **kwargs,
    ):
        # TODO update statusText according to language
        
        content = {"status": status, "statusText": statusText, "data": data}
        content.update(kwargs)
        super().__init__(content=content, status_code=status)


class FailJson(JSONResponse):
    def __init__(
        self,
        status: int = 400,
        statusText: Optional[str] = None,
        data: Optional[Any] = None,
        **kwargs,
    ):
        content = {"status": status, "statusText": statusText, "data": data}
        content.update(kwargs)
        super().__init__(content=content, status_code=status)


class SuccessPage(JSONResponse):
    def __init__(
        self,
        code: int = 200,
        msg: Optional[str] = None,
        data: Optional[Any] = None,
        total: int = 0,
        page: int = 1,
        page_size: int = 20,
        **kwargs,
    ):
        content = {
            "status": code,
            "statusText": msg,
            "data": data,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }
        content.update(kwargs)
        super().__init__(content=content, status_code=code)
