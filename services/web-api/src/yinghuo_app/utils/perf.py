import time

from ..log import logger

def timeit(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        end = time.perf_counter()
        elapsed = end - start
        logger.info(f'{func.__name__} Time taken: {elapsed:.6f} seconds')
        return result
    return wrapper