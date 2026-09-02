"""
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-13"

import uuid
from typing import Optional
from pydantic import BaseModel, Field

def uuid4():
    """Generate a random UUID."""
    return str(uuid.uuid4())

class Book(BaseModel):
    id: str = Field(default_factory=uuid4, alias="_id")
    title: str = Field(...)
    author: str = Field(...)
    synopsis: str = Field(...)

    class ConfigDict:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "066de609-b04a-4b30-b46c-32537c7f1f6e",
                "title": "Don Quixote",
                "author": "Miguel de Cervantes",
                "synopsis": "..."
            }
        }


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    synopsis: Optional[str] = None

    class ConfigDict:
        json_schema_extra = {
            "example": {
                "title": "Don Quixote",
                "author": "Miguel de Cervantes",
                "synopsis": "Don Quixote is a Spanish novel by Miguel de Cervantes..."
            }
        }
