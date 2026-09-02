"""
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-13"

import uuid
from typing import Optional
from pydantic import BaseModel, Field
from .func import uuid4, Func


class Stage(BaseModel):
    id: str = Field(default_factory=uuid4, alias="_id")
    name: str = Field(...)
    description: Optional[str] = Field(None)
    funcs: list[Func] = Field(default_factory=list)

    class ConfigDict:
        populate_by_name = True


class FuncFlow(BaseModel):
    id: str = Field(default_factory=uuid4, alias="_id")
    name: str = Field(...)
    description: Optional[str] = Field(None)
    version: str = Field(...)
    stages: list[Stage] = Field(default_factory=list)

    class ConfigDict:
        populate_by_name = True
