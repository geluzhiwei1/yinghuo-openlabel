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
图像工具
"""
__author__ = "Zhang Lizhi"
__date__ = "2024-01-03"

import numpy as np
import cv2
from io import BytesIO
import PIL.Image
import base64
from .http_utils import HTTPUtils

class ImageUtils:
    class Io:
        @staticmethod
        async def load_from_uri(img_uri:str)->PIL.Image:
            """_summary_

            Args:
                img_file (_type_): _description_
            """
            assert img_uri.startswith('http'), 'img_uri must start with http'
            from pyodide.http import pyfetch
            
            response = await pyfetch(img_uri)
            bytes = await response.bytes()
            img = PIL.Image.open(BytesIO(bytes))
            return img
        
        @staticmethod
        async def from_uri(img_uri:str)->PIL.Image:
            """_summary_

            Args:
                img_file (_type_): _description_
            """
            assert img_uri.startswith('http'), 'img_uri must start with http'
            image_bytes = await HTTPUtils.bytes(img_uri, method='GET')
            img = PIL.Image.open(BytesIO(image_bytes))
            return img
        
        @staticmethod
        def to_base64(img:PIL.Image)->str:
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return img_str
        
        @staticmethod
        def from_base64(img_str:str)->PIL.Image:
            image_data = base64.b64decode(img_str)
            img = PIL.Image.open(BytesIO(image_data))
            return img
        
        @staticmethod
        def to_dom_img_src(img:PIL.Image)->str:
            """转成可以在dom中使用的格式
                <img id="x" src=img_str/>
            Args:
                img (PIL.Image): image object

            Returns:
                str: _description_
            """
            img_str = 'data:image/jpeg;base64,' + ImageUtils.Io.to_base64(img)
            return img_str
    
    @staticmethod
    def crop(img:PIL.Image, left:int, upper:int, right:int, lower:int)->PIL.Image:
        im_crop = img.crop((left, upper, right, lower))
        return im_crop
    
    @staticmethod
    def undistort(img_hwc_rgb:np.array, K:np.array, D:np.array, alpha=0.0)->np.array:
        """图像去畸变

        Args:
            img_hwc_rgb (np.array): _description_
            K (np.array): 3,3
            D (np.array): distortion_coeffs
            alpha (float, optional): 0.:去除黑边,1保留黑边 Defaults to 0.0.

        Returns:
            np.array: _description_
        """
        height, width = img_hwc_rgb.shape[:2]
        imageSize = [width, height]
        m, _ = cv2.getOptimalNewCameraMatrix(K, D, imageSize, alpha, imageSize)
        img_undistored = cv2.undistort(img_hwc_rgb, K, D, dst=None, newCameraMatrix=m)
        
        return img_undistored