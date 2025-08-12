/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年12月20日 15:15:22
 * @date 甲辰 [龙] 年 冬月二十
 */

enum OlTypeEnum {
  BBox = 'BBox',
  RBBox = 'RBBox',

  Poly2d = 'Poly2d',
  Mask2dBase64 = 'Mask2dBase64',
  Mask2dRle = 'Mask2dRle',
  Mask2dFile = 'Mask2dFile',

  BBox3d = 'BBox3d',
  // Cuboid = "Cuboid",

  Polyline3d = 'Polyline3d',
  Point3d = 'Point3d',

  Point2d = 'Point2d',

  Context = 'Context',
  Action = 'Action',
  Event = 'Event'
}

type BaseObject = {
  object_id: string | undefined
  object_type: string | undefined
  object_uuid: string | undefined // 全局唯一
  object_attributes: {} | undefined
}

type BaseLabel = {
  label_uuid: string
  label_id: string
}

type CommonAttributes = {
  score?: number
  opType?: string
  log?: [] | undefined
  // 可以添加其他公共属性
}

enum BBoxTypeEnum {
  XYXY = 'XYXY', // xmin,ymin,xmax,ymax
  XYWH = 'XYWH', //  xmin,ymin,w,h
  CXCYWH = 'CXCYWH' // # center x,y
}
type BBox = BaseObject &
  BaseLabel & {
    /**
     * center x, center y, w, h
     */
    valType: BBoxTypeEnum
    val: Array<number> // center x, center y, w, h
    attributes: CommonAttributes
  }
type RBBox = BaseObject &
  BaseLabel & {
    /**
     * center x, center y, dim x, dim y, alpha
     */
    ol_type_: OlTypeEnum.RBBox
    val: Array<number>
    attributes: CommonAttributes
  }

type Poly2d = BaseObject &
  BaseLabel & {
    val: Array<number> // x1,y1,x2,y2,...
    attributes: CommonAttributes & {
      mode: 'MODE_POLY2D_ABSOLUTE'
      closed: boolean
      /**
       * width,height of image
       */
      image_shape: [number, number]
    }
  }

type Mask2dBase64 = BaseObject &
  BaseLabel & {
    encoding: 'base64'
    mimeType: string // "image/png"
    val: string // base64 string, start with data:image/png;base64,
    attributes: CommonAttributes & {
      /**
       * left,top,width,height of mask
       */
      ltwh: [number, number, number, number]
      /**
       * width,height of image
       */
      image_shape: [number, number]
    }
    ol_type_: OlTypeEnum.Mask2dBase64
  }

type Mask2dFile = BaseObject &
  BaseLabel & {
    encoding: 'file'
    mimeType: string // "image/png"
    val: string // file path
    attributes: CommonAttributes & {
      ltwh: [number, number, number, number] // left,top,width,height of mask
      image_shape: [number, number] // width,height of image
    }
  }

type Cuboid = BaseObject &
  BaseLabel & {
    ol_type_: OlTypeEnum.Cuboid
    coordinate_system: string
    /**
     * x, y, z, rx, ry, rz, sx, sy, sz
     */
    val: Array<number>
    attributes: CommonAttributes
  }
type BBox3d = Cuboid & {
  ol_type_: OlTypeEnum.BBox3d
}

type Polyline3d = BaseObject &
  BaseLabel & {
    ol_type_: OlTypeEnum.Polyline3d
    // coordinate_system: string
    // closed: true
    // mode: string | undefined
    val: Array<number> // x,y,z,x1,y1,z1,...
  }

type Point2d = BaseObject &
  BaseLabel & {
    ol_type_: 'Point2d'
    /**
     * x, y
     */
    val: Array<number>
    attributes: CommonAttributes
  }

type Point3d = BaseObject &
  BaseLabel & {
    ol_type_: 'Point3d'
    /**
     * x, y, z * number of points
     */
    val: Array<number>
    attributes: CommonAttributes
  }

type FrameInterval = {
  frame_start: number
  frame_end: number
  time_start: number
  time_end: number
}

type BaseContext = BaseObject &
  BaseLabel & {
    attributes: CommonAttributes
    frame_intervals: Array<FrameInterval>
  }

type Event = BaseContext & {
  ol_type_: 'Event'
  event_data: CommonAttributes
}

type Action = BaseContext & {
  ol_type_: 'Action'
  action_data: CommonAttributes
}

type Context = BaseContext & {
  ol_type_: 'Context'
  context_data: CommonAttributes
}

export type { Context, Action, Event }
export type {
  Polyline3d,
  BBox3d,
  Cuboid,
  BBox,
  RBBox,
  Poly2d,
  Mask2dBase64,
  Mask2dFile,
  Point3d,
  Point2d
}
export { OlTypeEnum, BBoxTypeEnum }
