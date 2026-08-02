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
from .config import settings


def init_logger(log_file=None, log_level=logging.INFO):
    stream_handler = logging.StreamHandler()
    handlers = [stream_handler]

    if log_file is not None:
        log_dir = os.path.dirname(log_file)
        os.makedirs(log_dir, exist_ok=True)
        file_handler = TimedRotatingFileHandler(log_file, when='midnight', interval=1, backupCount=8, utc=True)
        handlers.append(file_handler)

    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s %(filename)s %(lineno)d - %(message)s')
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.setLevel(log_level)

    logging.basicConfig(level=log_level, handlers=handlers)


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
