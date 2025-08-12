/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年12月20日 14:24:47
 * @date 甲辰 [龙] 年 冬月二十
 */

import _ from 'lodash'
import { BBoxTypeEnum, type Poly2d, type Mask2dBase64 } from '.'
import { set } from 'radash'
import { type BBox } from '@/openlabel'

/***
 *
 */
const parseBBoxes = (openlabel: any, frameNo: undefined | number): BBox[] | undefined => {
  if (!frameNo) {
    frameNo = 0
  }
  const objects = _.get(openlabel, `openlabel.frames[${frameNo}].objects`, null)
  if (!objects) {
    return undefined
  }
  const bboxes: BBox[] = []
  _.forEach(objects, (obj, key) => {
    const bboxObj = _.get(obj, 'object_data.bbox[0]')
    if (bboxObj) {
      bboxObj as BBox
      // convert to BBoxTypeEnum.CXCYWH
      switch (bboxObj.val_type) {
        case BBoxTypeEnum.CXCYWH:
          break
        case BBoxTypeEnum.XYWH:
          bboxObj.val_type = BBoxTypeEnum.CXCYWH
          bboxObj.val = xywhTocxcywh(bboxObj.val)
          break
        case BBoxTypeEnum.XYXY:
          bboxObj.val_type = BBoxTypeEnum.CXCYWH
          bboxObj.val = ltrbToCxcywh(bboxObj.val)
          break
      }
      bboxes.push(bboxObj)
    }
  })

  return bboxes
}

/**
 * center x, center y, width, height 转为 left,top,width,height
 */
export const cxcywhToxywh = (cxcywh: Array<number>): Array<number> => {
  return [cxcywh[0] + cxcywh[2] / 2, cxcywh[1] + cxcywh[3] / 2, cxcywh[2], cxcywh[3]]
}
export const xywhTocxcywh = (xywh: Array<number>): Array<number> => {
  return [xywh[0] - xywh[2] / 2, xywh[1] - xywh[3] / 2, xywh[2], xywh[3]]
}
/**
 * 中心坐标和宽度/高度 -> 左上角的坐标和右下角的坐标
 * @param cxcywh 数组，包含中心点的 x 坐标、y 坐标、宽度和高度
 * @returns 数组，包含左上角的 x 坐标、y 坐标、右下角的 x 坐标和 y 坐标
 */
export const cxcywhToltrb = (cxcywh: Array<number>): Array<number> => {
  const [cx, cy, w, h] = cxcywh
  const left = cx - w / 2
  const top = cy - h / 2
  const right = cx + w / 2
  const bottom = cy + h / 2
  return [left, top, right, bottom]
}

/**
 * 左上角的坐标和右下角的坐标 -> 中心坐标和宽度/高度
 * @param ltrb 数组，包含左上角的 x 坐标、y 坐标、右下角的 x 坐标和 y 坐标
 * @returns 数组，包含中心点的 x 坐标、y 坐标、宽度和高度
 */
export const ltrbToCxcywh = (ltrb: Array<number>): Array<number> => {
  const [left, top, right, bottom] = ltrb
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const w = right - left
  const h = bottom - top
  return [cx, cy, w, h]
}

export const ltrbToXywh = (ltrb: Array<number>): Array<number> => {
  const [left, top, right, bottom] = ltrb
  const w = right - left
  const h = bottom - top
  return [left, top, w, h]
}

/**
 * 转为四个角坐标，顺时针
 * @param cxcywh
 * @returns
 */
export const cxcywhToCorners = (cxcywh: Array<number>): Array<number> => {
  const [left, top, right, bottom] = cxcywhToltrb(cxcywh)
  return [left, top, right, top, right, bottom, left, bottom]
}

const parsePoly2d = (openlabel: any, frameNo: undefined | number): Poly2d[] | undefined => {
  if (!frameNo) {
    frameNo = 0
  }
  const objects = _.get(openlabel, `openlabel.frames[${frameNo}].objects`, null)
  if (!objects) {
    return
  }
  const annotator = _.get(openlabel, 'openlabel.metadata.annotator', '')
  const polys: Poly2d[] = []
  _.forEach(objects, (obj, key) => {
    const objs = _.get(obj, 'object_data.poly2d', undefined)
    if (!objs) {
      return
    }
    objs.map((objPoly2d: any) => {
      const poly2d = objPoly2d as Poly2d
      set(poly2d.attributes, 'annotator', annotator)
      polys.push(poly2d)
    })

    // 删除这个对象，否则会重复解析
    delete obj.object_data.poly2d
  })

  return polys
}

export const parseMask2dBase64 = (
  openlabel: any,
  frameNo: undefined | number
): Mask2dBase64[] | undefined => {
  if (!frameNo) {
    frameNo = 0
  }
  const objects = _.get(openlabel, `openlabel.frames[${frameNo}].objects`, null)
  if (!objects) {
    return
  }
  const annotator = _.get(openlabel, 'openlabel.metadata.annotator', '')
  const polys: Mask2dBase64[] = []
  _.forEach(objects, (obj, key) => {
    const objs = _.get(obj, 'object_data.mask', undefined)
    if (!objs) {
      return
    }
    objs.map((objPoly2d: any) => {
      const poly2d = objPoly2d as Mask2dBase64
      set(poly2d.attributes, 'annotator', annotator)
      polys.push(poly2d)
    })

    delete obj.object_data.poly2d
  })

  return polys
}

export { parseBBoxes, parsePoly2d }
