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
"""
parse meta file
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-01-23"

import json
from typing import Optional
import aiohttp

IS_IN_WEB_BROWSER = False

class HTTPUtils:
    
    @staticmethod
    async def request(url:str, method:str = "GET", body:Optional[str] = None,
            headers:Optional[dict[str,str]] = None) -> any:
        """
        Async request function. Pass in Method and make sure to await!
        Parameters:
            method: str = {"GET", "POST", "PUT", "DELETE"} from javascript global fetch())
            body: str = body as json string. Example, body=json.dumps(my_dict)
            header: dict[str,str] = header as dict, will be converted to string... 
                Example, header:json.dumps({"Content-Type":"application/json"})
        Return: 
            response: pyodide.http.FetchResponse = use with .status or await.json(), etc.
        """
        from pyodide.http import pyfetch
        kwargs = {"method":method, "mode":"cors"}
        if body and method not in ["GET", "HEAD"]:
            kwargs["body"] = body
        if headers:
            kwargs["headers"] = headers

        response = await pyfetch(url, **kwargs)
        return response
    
    @staticmethod
    async def json(uri, method:str = "GET", params:Optional[dict[str,str]] = None, headers:Optional[dict[str,str]] = None):
        if IS_IN_WEB_BROWSER:
            if headers is None:
                headers = {}
            headers.update({"Content-Type":"application/json"})
            response = await HTTPUtils.request(uri, method=method, body=json.dumps(params), headers=headers)
            return await response.json()
        else:
            async with aiohttp.ClientSession() as session:
                if method == 'POST':
                    resp = await session.post(uri, json=params, headers=headers)
                else:
                    resp = await session.get(uri, params=params, headers=headers)
                # print(resp.status)
                return await resp.json()
        
    @staticmethod
    async def text(uri, method:str = "GET", params:Optional[dict[str,str]] = None, headers:Optional[dict[str,str]] = None):
        if IS_IN_WEB_BROWSER:
            response = await HTTPUtils.request(uri, method=method, body=json.dumps(params), headers=headers)
            return await response.text()
        else:
            async with aiohttp.ClientSession() as session:
                if method == 'POST':
                    resp = await session.post(uri, json=params, headers=headers)
                else:
                    resp = await session.get(uri, params=params, headers=headers)
                # print(resp.status)
                return await resp.text()
        
    @staticmethod
    async def bytes(uri, method:str = "GET", params:Optional[dict[str,str]] = None, headers:Optional[dict[str,str]] = None):
        if IS_IN_WEB_BROWSER:
            response = await HTTPUtils.request(uri, method=method, body=json.dumps(params), headers=headers)
            return await response.bytes()
        else:
            async with aiohttp.ClientSession() as session:
                if method == 'POST':
                    resp = await session.post(uri, json=params, headers=headers)
                else:
                    resp = await session.get(uri, params=params, headers=headers)
                # print(resp.status)
                if resp.status == 200:
                    return await resp.read()
                else:
                    raise Exception(f'response status = {resp.status}')