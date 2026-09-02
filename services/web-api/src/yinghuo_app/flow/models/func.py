"""
Func schema
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-13"

import uuid
from typing import Optional
from pydantic import BaseModel, Field


def uuid4():
    """Generate a random UUID."""
    return str(uuid.uuid4())


class Func(BaseModel):
    id: str = Field(default_factory=uuid4, alias="_id")
    name: str = Field(None)
    description: Optional[str] = Field(None)
    app_service_name: Optional[str] = Field(None)
    app_module_name: Optional[str] = Field(None)
    version: str = Field(None)

    class ConfigDict:
        populate_by_name = True
        json_encoders = {
            uuid.UUID: lambda v: str(v),
        }
