"""
logger
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-11"

import os
import logging
from ..config.config import gConf


def init_logger(module_name, log_file_name):
    log_file = os.path.join(gConf['global']['log']['root_dir'], module_name, log_file_name)
    level = gConf['global']['log']['level'].lower()
    if 'debug' == level:
        log_level = logging.DEBUG
    elif 'info' == level:
        log_level = logging.INFO
    elif 'warning' == level:
        log_level = logging.WARNING
    elif 'error' == level:
        log_level = logging.ERROR
    elif 'critical' == level:
        log_level = logging.CRITICAL
    
    print(f'Init log {level}: {log_file}')
    
    return init_logger_(log_file, log_level=log_level)

def init_logger_(log_file, log_level=logging.INFO):
    
    stream_handler = logging.StreamHandler()
    handlers = [stream_handler]

    if log_file is not None:
        base_dir = os.path.dirname(log_file)
        os.makedirs(base_dir, exist_ok=True)
        file_handler = logging.FileHandler(log_file, 'w')
        handlers.append(file_handler)

    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s %(filename)s %(lineno)d - %(message)s')
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.setLevel(log_level)

    logging.basicConfig(level=log_level, handlers=handlers)
