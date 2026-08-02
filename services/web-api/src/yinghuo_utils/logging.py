"""
web inferencer
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-11"


import logging


def init_logger(log_file=None, log_level=logging.INFO):
    stream_handler = logging.StreamHandler()
    handlers = [stream_handler]

    if log_file is not None:
        file_handler = logging.FileHandler(log_file, 'w')
        handlers.append(file_handler)

    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s %(filename)s %(lineno)d - %(message)s')
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.setLevel(log_level)

    logging.basicConfig(level=log_level, handlers=handlers)
    
    return logging
