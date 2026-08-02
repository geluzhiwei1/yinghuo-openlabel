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
            "page_size": page_size,
        }
        content.update(kwargs)
        super().__init__(content=content, status_code=code)
