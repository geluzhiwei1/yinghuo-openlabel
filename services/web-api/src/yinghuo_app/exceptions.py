from fastapi.exceptions import (
    HTTPException,
    RequestValidationError,
    ResponseValidationError,
)
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from tortoise.exceptions import DoesNotExist, IntegrityError


class BizException(Exception):

    def __init__(
        self,
        status: int = 200,
        statusText: str = "OK",
    ):
        self.statusText = statusText
        self.status = status
        
        
class SettingNotFound(Exception):
    pass
