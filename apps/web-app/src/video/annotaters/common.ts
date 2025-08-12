/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月
 * @date 甲辰 [龙] 年 三月
 */

import { fabric } from 'fabric'
import _ from 'lodash'


class Vector2 {
    x: number = 0.0
    y: number = 0.0
}

enum AnnoWorkEnum {
    FREE = 'free',

    // 子工具状态
    SUBTOOL_WAITING = 'sub-tool-waiting',
    SUBTOOL_DRAWING = 'sub-tool-drawing',

    // bbox
    BBOX_BUILDER_WATING = 'bbox-builderTool-waiting',
    BBOX_BUILDER_DRAWING = 'bbox-object-drawing',
    BBOX_OBJECT_SELECTTED = 'bbox-object-selected',
    BBOX_ANNOTATER = 'bbox-annotater',

    // polyline
    POLY_BUILDER_WATING = 'poly-builder-waiting',
    POLY_BUILDER_DRAWING = 'poly-builder-drawing',
    POLY_PENCIL_WATING = 'poly-pencil-waiting',
    POLY_PENCIL_DRAWING = 'poly-pencil-drawing',
    POLY_OBJECT_SELECTTED = 'poly-object-selected',
    POLY_ANNOTATER = 'poly-annotater',
}


export { Vector2, AnnoWorkEnum }