import asyncio
from datetime import datetime

from tortoise import fields, models

from ...config import settings


class BaseModel(models.Model):
    id = fields.BigIntField(pk=True, index=True)

    async def to_dict(self, m2m: bool = False, exclude_fields: list[str] | None = None, include_fields: list[str] | None = None):
        """如果include_fields不为空，则只返回include_fields中的字段，忽略exclude_fields参数

        Args:
            m2m (bool, optional): _description_. Defaults to False.
            exclude_fields (list[str] | None, optional): _description_. Defaults to None.
            include_fields (list[str] | None, optional): _description_. Defaults to None.
        Returns:
            _type_: _description_
        """
        if include_fields is not None and len(include_fields) > 0:
            d = {}
            for field in self._meta.db_fields:
                if field in include_fields:
                    value = getattr(self, field)
                    if isinstance(value, datetime):
                        value = value.strftime(settings.DATETIME_FORMAT)
                    d[field] = value
        else:
            if exclude_fields is None:
                exclude_fields = []

            d = {}
            for field in self._meta.db_fields:
                if field not in exclude_fields:
                    value = getattr(self, field)
                    if isinstance(value, datetime):
                        value = value.strftime(settings.DATETIME_FORMAT)
                    d[field] = value
        if m2m:
            tasks = [self.__fetch_m2m_field(field) for field in self._meta.m2m_fields if field not in exclude_fields]
            results = await asyncio.gather(*tasks)
            for field, values in results:
                d[field] = values
        return d

    async def __fetch_m2m_field(self, field):
        values = [value for value in await getattr(self, field).all().values()]
        for value in values:
            value.update((k, v.strftime(settings.DATETIME_FORMAT)) for k, v in value.items() if isinstance(v, datetime))
        return field, values

    class Meta:
        abstract = True



class TimestampMixin:
    created_at = fields.DatetimeField(auto_now_add=True, index=True)
    updated_at = fields.DatetimeField(auto_now=True, index=True)
