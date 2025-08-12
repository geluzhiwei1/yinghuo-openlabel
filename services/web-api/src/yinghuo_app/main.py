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
#!/usr/bin/env python
"""
main app
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-24"

import uvicorn
from yinghuo_conf import Conf
from fastapi import FastAPI, Request

if __name__ == "__main__":
    uvicorn.run("yinghuo_app.app:app", host="0.0.0.0", port=8423)
