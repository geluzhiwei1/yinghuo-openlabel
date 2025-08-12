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

import PIL
import PIL.Image
import PIL.ImageDraw
import base64
from io import BytesIO
import numpy as np
import pydash as _

from openlabel.models import openlabel


def from_base64(img_str:str)->PIL.Image:
    image_data = base64.b64decode(img_str)
    img = PIL.Image.open(BytesIO(image_data))
    return img


def ol_image_to_mask(img: openlabel.Mask2dBase64)->PIL.Image:
    
    def build_mask(img_str, left, top, orig_width, orig_height, fill_color=255, mode='L')->PIL.Image:
        img = from_base64(img_str)
        bitmap = img.convert('1')
        mask = PIL.Image.new(mode=mode, size=(orig_width, orig_height), color=0)
        draw = PIL.ImageDraw.Draw(mask)
        draw.bitmap((left, top), bitmap, fill=fill_color)
        return mask
    
    img_str = img.val.replace('data:image/png;base64,', '')
    orig_width, orig_height = img.attributes.image_shape[0], img.attributes.image_shape[1]
    
    left = img.attributes.ltwh[0]
    top = img.attributes.ltwh[1]
            
    mask = build_mask(img_str, left, top, orig_width, orig_height)
    return mask

def rle_to_mask(rle: dict) -> PIL.Image:
    """
    将RLE格式的掩码转换为PIL.Image对象
    
    参数:
        rle: RLE格式的字典，包含counts和size字段
        
    返回:
        PIL.Image对象，模式为'L'（8位像素，黑白）
    """
    from pycocotools import mask as maskUtils
    binary_mask = maskUtils.decode(rle)
    
    pil_image = PIL.Image.fromarray(binary_mask.astype(np.uint8) * 255, mode='L')
    
    return pil_image

def mask_to_rle(mask: PIL.Image) -> dict:
    """
    将PIL.Image对象转换为RLE格式掩码
    
    参数:
        mask: PIL.Image对象，模式为'L'（8位像素，黑白）
        
    返回:
        RLE格式的字典，包含counts和size字段
    """
    from pycocotools import mask as maskUtils
    binary_mask = np.asfortranarray(np.array(mask).astype(np.uint8))
    rle = maskUtils.encode(binary_mask)
    rle["counts"] = rle["counts"].decode("utf-8")
    return rle

def ol_polygon_to_mask(img: openlabel.Poly2d, params:dict)->PIL.Image:
    
    def build_mask(xys:list, orig_width, orig_height, fill_color=255, mode='L')->PIL.Image:
        mask = PIL.Image.new(mode=mode, size=(orig_width, orig_height), color=0)
        draw = PIL.ImageDraw.Draw(mask)
        draw.polygon(xys, fill=fill_color, width=1)
        return mask
    
    orig_width, orig_height = params['orig_width'], params['orig_height']
    
    xys = img.val
    if len(xys) < 3:
        print("No enough points:", xys)
        return None
    
    # 添加最后一个点，使闭合
    if not xys[-1] == xys[1]:
        xys.append(xys[0])
        xys.append(xys[1])
            
    mask = build_mask(xys, orig_width, orig_height)
    return mask

def bbox_to_CXCYWH(bbox: openlabel.BBox)->openlabel.BBox:
    """Convert bbox to CXCYWH, inplace.

    Args:
        bbox (openlabel.BBox): _description_

    Returns:
        openlabel.BBox: _description_
    """
    if bbox.val_type == openlabel.BBox.ValTypeEnum.CXCYWH:
        return bbox
    elif bbox.val_type == openlabel.BBox.ValTypeEnum.XYXY:
        cxcwyh = [
            (bbox.val[0] + bbox.val[2]) / 2,
            (bbox.val[1] + bbox.val[3]) / 2,
            bbox.val[2] - bbox.val[0],
            bbox.val[3] - bbox.val[1]]
        bbox.val_type = openlabel.BBox.ValTypeEnum.CXCYWH
        bbox.val = cxcwyh
        return bbox
    elif bbox.val_type == openlabel.BBox.ValTypeEnum.XYWH:
        cxcwyh = [
            (bbox.val[0] + bbox.val[2] / 2),
            (bbox.val[1] + bbox.val[3] / 2),
            bbox.val[2],
            bbox.val[3]]
        bbox.val_type = openlabel.BBox.ValTypeEnum.CXCYWH
        bbox.val = cxcwyh
        return bbox
    else:
        raise ValueError(f"Unknown bbox type {bbox.val_type}")

def pil_to_base64(
    pil_image: PIL.Image,
) -> str:
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    base64_str = f"data:image/png;base64,{img_str}"
    
    return base64_str

def ol_mask2dbase64_to_mask(
    mask2d: dict #openlabel.Mask2dBase64,
) -> PIL.Image:
    img_str = mask2d["val"].replace('data:image/png;base64,', '')
    mask_img = from_base64(img_str)
    
    def build_mask(mask_img:PIL.Image, left:int, top:int, 
                   orig_width, orig_height, fill_color=255, mode='1')->PIL.Image:
        mask = PIL.Image.new(mode=mode, size=(orig_width, orig_height), color=0)
        
        mask_img = mask_img.convert(mode, colors=fill_color)
        mask.paste(mask_img, (left, top))
        # 二值化
        mask = mask.convert(mode, colors=fill_color)
        return mask
    
    orig_width, orig_height = mask2d["attributes"]["image_shape"][0], mask2d["attributes"]["image_shape"][1]
    left, top = mask2d["attributes"]["ltwh"][0], mask2d["attributes"]["ltwh"][1]
    mask = build_mask(mask_img, int(left), int(top), orig_width, orig_height)
    
    # 从mask找到bounding box
    mask_arr = np.array(mask)
    rows = np.any(mask_arr, axis=1)
    cols = np.any(mask_arr, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    
    x1, y1, w, h = [cmin, rmin, cmax - cmin, rmax - rmin]
    
    return mask, (x1, y1, w, h)

# def pil_to_mask2dbase64(
#     pil_image: PIL.Image,
# ) -> openlabel.Mask2dBase64:
#     base64_str = pil_to_base64(pil_image)
    
#     mask = openlabel.Mask2dBase64(
#         ol_type_ = "Mask2dBase64",
#         val = base64_str,
#         attributes = openlabel.Mask2dBase64.Attributes(
#             image_shape = [pil_image.width, pil_image.height],
#             ltwh = [0, 0, pil_image.width, pil_image.height]
#         ),
#     )
    
#     return mask