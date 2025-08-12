/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月18日15:50:42
 * @date 甲辰 [龙] 年 三月初十
 */
import { fabric } from 'fabric'
import { type BBox, type RBBox, OlTypeEnum } from '@/openlabel'
import { globalStates } from '@/states'

export const setRectFromBoxObj = (box: fabric.Rect, boxObj: BBox | RBBox) => {
    switch (boxObj.ol_type_) {
        case OlTypeEnum.BBox: {
            const [cx, cy, w1, h1] = boxObj.val
            const w = w1 / box.scaleX!
            const h = h1 / box.scaleY!
            // box.left = cx - w / 2
            // box.top = cy - h / 2
            // box.width = w
            // box.height = h
            box.set({
                left: cx - w / 2,
                top: cy - h / 2,
                width: w,
                height: h
            })
            break
        }
        case OlTypeEnum.RBBox: {
            const [cx, cy, dimx, dimy, theta] = boxObj.val
            const w = dimx / box.scaleX!
            const h = dimy / box.scaleY!
            // box.left = cx
            // box.top = cy
            box.width = w
            box.height = h
            box.angle = thetaToangle(theta)
            box.setPositionByOrigin(new fabric.Point(cx, cy), 'center', 'center')
            break
        }
        default:
            throw new Error('Invalid geometry type')
    }
}

export const angleToTheta = (angle: number) => {
    // let alpha = Math.PI / 2
    // const opencvangle = angle % 90
    // if (opencvangle != 0) {
    //     alpha = opencvangle * (Math.PI / 180)
    // }
    return angle
}

export const thetaToangle = (theta: number) => {
    // let alpha = Math.PI / 2
    // const opencvangle = angle % 90
    // if (opencvangle != 0) {
    //     alpha = opencvangle * (Math.PI / 180)
    // }
    return theta
}

/** 
 *
 *  Given coordinages of [x1, y1, x2, y2, x3, y3, x4, y4]
 *  where the corners are:
 *            top left    : x1, y1
 *            top right   : x2, y2
 *            bottom right: x3, y3
 *            bottom left : x4, y4
 *
 *  The centre is the average top left and bottom right coords:
 *  center: (x1 + x3) / 2 and (y1 + y3) / 2
 *
 *  Clockwise rotation: Math.atan((x1 - x4)/(y1 - y4)) with
 *  adjustment for the quadrant the angle is in.
 */
export const cornersToCxcydxdyangle = (coords: number[]) => {
    const [x1, y1, x2, y2, x3, y3, x4, y4] = coords
    const center = [(x1 + x3) / 2, (y1 + y3) / 2]
    // let rotation = Math.atan(diffs[0]/diffs[1]) * 180 / Math.PI
    // if (diffs[1] < 0) {
    //     rotation += 180;
    // } else if (diffs[0] < 0) {
    //     rotation += 360;
    // }
    const diffs = [x1 - x4, y1 - y4]
    const rad = Math.atan2(diffs[1], diffs[0])
    let rotation = rad * 180 / Math.PI
    if (0 <= rotation && rotation <= 90) {
        rotation = -rotation + 90
    } else if (90 < rotation && rotation <= 180) {
        rotation = -rotation + 180 + 270
    } else if (-90 <= rotation && rotation < 0) {
        rotation = -rotation + 90
    } else if (-180 <= rotation && rotation < -90) {
        rotation = -rotation + 180
    }

    const dimx = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    const dimy = Math.sqrt(Math.pow(x3 - x2, 2) + Math.pow(y3 - y2, 2))

    return [...center, dimx, dimy, rotation, rad, rad * 180 / Math.PI];
}

const getCanvasInverImatrix = ctx => {
    // const ctx = ctx.getContext('2d')
    const transform = ctx.getTransform()
    return transform.invertSelf();
}

// canvas坐标转屏幕坐标
export const canvasToScreen = (ctx, { x, y }) => {
    const imatrix = getCanvasInverImatrix(ctx)
    if (imatrix.is2D) {
        const { a, b, c, d, e, f } = imatrix
        const screenX = (c * y - d * x + d * e - c * f) / (b * c - a * d)
        const screenY = (y - screenX * b - f) / d
        return {
            x: Math.round(screenX),
            y: Math.round(screenY),
        }
    } else {
        return {
            x: NaN,
            y: NaN
        }
    }
}

// 屏幕坐标转canvas坐标
export const screenToCanvas = (ctx, { x, y }) => {
    const imatrix = getCanvasInverImatrix(ctx)
    if (imatrix.is2D()) {
        const {a, b, c, d, e, f} = imatrix
        return {
            x: Math.round(x * a + y * c + e),
            y: Math.round(x * b + y * d + f)
        };
    } else {
        return {
            x: NaN,
            y: NaN
        }
    }
}

export const shortcutCallback = (toolId:string) => {
    if (globalStates.subTool === toolId) {
        globalStates.subTool = ''
    } else {
        globalStates.subTool = toolId
    }
}