#!/usr/bin/env python
"""
main app
"""
__author__ = "Zhang Lizhi"
__date__ = "2023-10-24"

import uvicorn
from yinghuo_app.config import Conf
from fastapi import FastAPI, Request


if __name__ == "__main__":
    uvicorn.run("yinghuo_app.app:app", host="0.0.0.0", port=int(Conf.SERV_SERVER_PORT))
