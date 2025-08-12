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
web inferencer
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-11"

import os
import logging
from logging.handlers import TimedRotatingFileHandler
import sys
from loguru import logger as loguru_logger
from yinghuo_conf import settings

class Loge:
    def __init__(self) -> None:
        debug = settings.DEBUG
        if debug:
            self.level = "DEBUG"
        else:
            self.level = "INFO"

    def setup(self):
        os.makedirs('logs', exist_ok=True)
        loguru_logger.remove()
        loguru_logger.add(sink=sys.stdout, level=self.level)
        loguru_logger.add(f"./logs/yinghuo-app.log", level=self.level, rotation="100 MB")  # Output log messages to a file
        return loguru_logger
loge = Loge()
logger = loge.setup()
