/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年8月30日 甲辰 [龙] 年 七月廿七
 */
import { watch, reactive, computed } from 'vue'
import { fabric } from 'fabric'
import { Annotater } from './annotater'
import { AnnoWorkEnum } from "./common"
import { globalStates } from '@/states'
import { type Poly2d, OlTypeEnum } from '@/openlabel'
import { shortcutCallback } from './utils'
import { loadRustWasm } from '@/libs/plugin'
import { set, get } from 'radash'
import { ElMessage } from 'element-plus'
import { messages } from '@/states'
import { poly2dAnnotaterStates, type UserObject } from './polylineAnnotater'
import { freeDrawOptions, FreeDrawingCursor } from '@/libs/free-draw'
import type { RenderHelper } from '../RenderHelper'


const defaultSettingFormData = {
    options: {
        brushType: '',
        brushWidth: 10,
        brushFill: 'rgba(0,200,0,0.3)',
    },
    funcSetting: {
        func: '',
        // brush
        brush: {
            width: 30,
            fill: 'rgba(0,200,0,0.3)',
        },
        // erase
        erase: {
            width: 30,
            fill: 'rgba(200,0,0,0.3)',
        },
        // smooth
        smooth: {
            iters: 2,
        },
        // remove_repeated
        // simplify
        simplify: {
            epsilon: 1.0,
            algo: 'simplify'
        },
        densify: {
            max_distance: 5.0
        }
    }
}

export const toolOptions = reactive({
    zIndex: 90,
    enabled: true,
    settingFormData: {
        ...defaultSettingFormData.options,
    },
    funcSetting: {
        ...defaultSettingFormData.funcSetting,
    }
})

export const hotPolyBarOptions = reactive({
    enabled: true,
    visible: false,
    style: {
        top: 0 + 'px',
        left: 0 + 'px',
        position: 'absolute',
        // justifyContent: 'center',
        // alignItems: 'center',
        width: '100%'
    }
})

const TOOL_ID = "polygonEditor"
export const toolConf = {
    id: TOOL_ID,
    icon: 'fluent-mdl2:edit-create',
    name: '多边形编辑',
    shortcut: 'E',
    description: '<el-text>开启此功能，再选择要编辑的对象</el-text>',
    handler: () => { },
    shortcutCallback: () => { shortcutCallback(TOOL_ID) }
}

class PolygonEditor extends Annotater {
    static name = TOOL_ID
    static instance: PolygonEditor

    private freeDrawingCursor: FreeDrawingCursor

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)

        // 本工具管理的对象
        this.freeDrawingCursor = new FreeDrawingCursor(baseCanva.canvasObj)
        this.baseCanva.fabricObjects.set(toolOptions.zIndex + 1, this.freeDrawingCursor.cursor)

        // this.onMouseUp = this.onMouseUp.bind(this)
        // this.onMouseDown = this.onMouseDown.bind(this)
        // this.onMouseMove = this.onMouseMove.bind(this)
        // this.offWatch = this.offWatch.bind(this)
        this.onPathCreated = this.onPathCreated.bind(this)

        // hotkeys
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'enter| ', cb: this.onEnter.bind(this) })
        this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'escape', cb: this.onEsc.bind(this) })
        // this.hotkeysManagerAutoOff.registerHotkeys({ toolId: TOOL_ID, keys: 'z', cb: this.onKeyZ.bind(this) })
        this.hotkeysManager.registerHotkeys({ toolId: TOOL_ID, keys: toolConf.shortcut, cb: toolConf.shortcutCallback })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '1',
            cb: () => {
                this.setBrushType('brush')
            }
        })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '2',
            cb: () => {
                this.setBrushType('eraser')
            }
        })
        this.hotkeysManagerAutoOff.registerHotkeys({
            toolId: TOOL_ID,
            keys: '3',
            cb: () => {
                this.setBrushType('')
            }
        })


    // 调整画笔大小
    this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'd',
        cb: () => {
          switch (freeDrawOptions.brushType)  {
            case 'brush':
              freeDrawOptions.brush.width -= freeDrawOptions.step
              break
            case 'eraser':
              freeDrawOptions.eraser.width -= freeDrawOptions.step
              break
            default:
              break
          }
        }
      })
      this.hotkeysManagerAutoOff.registerHotkeys({
        toolId: TOOL_ID,
        keys: 'a',
        cb: () => {
          switch (freeDrawOptions.brushType)  {
            case 'brush':
              freeDrawOptions.brush.width += freeDrawOptions.step
              break
            case 'eraser':
              freeDrawOptions.eraser.width += freeDrawOptions.step
              break
            default:
              break
          }
        }
      })

        this.initSub({ toolId: TOOL_ID })

        loadRustWasm().then((m) => {
            toolOptions.enabled = true
        }).catch(err => {
            toolOptions.enabled = false
            console.error(err)
        })

        PolygonEditor.instance = this
    }

    doExcuteCmd(cmd: string) {
        const editedObj = globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID)
        const polyVal = get(editedObj, 'userData.anno.val', undefined)
        if (!polyVal) {
            ElMessage.info('请先选择一个多边形作为操作目标')
            return
        }
        let newPoly = undefined
        switch (cmd) {
            case 'smooth':
                newPoly = window.labelHelper.polygon_chaikin_smoothing(polyVal,
                    toolOptions.funcSetting.smooth.iters)
                break;
            case 'simplify':
                newPoly = window.labelHelper.polygon_simplify(polyVal,
                    toolOptions.funcSetting.simplify.epsilon, toolOptions.funcSetting.simplify.algo)
                break;
            case 'densify':
                newPoly = window.labelHelper.polygon_densify(polyVal, toolOptions.funcSetting.densify.max_distance)
                break;
            case 'remove_repeated':
                newPoly = window.labelHelper.polygon_remove_repeated_points(polyVal)
                break;
            default:
                break;
        }
        if (newPoly && newPoly instanceof Array) {
            // ElMessage.info(`操作成功：点数由${polyVal.length / 2}变为${newPoly.length / 2}`)
            messages.lastInfo = `操作成功：点数由${polyVal.length / 2}变为${newPoly.length / 2}`
        } else {
            messages.lastInfo = '操作失败' + newPoly
        }
        return newPoly
    }

    private attachedUUID: string | undefined = undefined
    /**
     * 工具关联到一个对象
     * @param uuid
     */
    attach(uuid: string) {
        if (!uuid) return
        if (uuid === this.attachedUUID) return

        // 释放老的
        this.unattach()

        this.attachedUUID = uuid
        set(globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID), 'userData.ownTool', TOOL_ID)
        globalStates.mainAnnoater.lockSeleted([this.attachedUUID])
    }

    /**
     * 工具不再关联
     */
    unattach() {
        if (this.attachedUUID) {
            set(globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID), 'userData.ownTool', undefined)
            globalStates.mainAnnoater.unlockSeleted([this.attachedUUID])
            this.attachedUUID = undefined
        }
    }

    doActivate() {
        const selectedUUID = globalStates.mainAnnoater.getSelectedFabricObjectUUID()
        if (selectedUUID) {
            this.attach(selectedUUID)
        }
        // ImageCanvas.instance.getImageObj()?.clone((imageObj: any) => {
        //     this.baseCanva.canvasObj.setBackgroundImage(imageObj, () => {
        //         this.baseCanva.canvasObj.requestRenderAll()
        //     })
        // })
        this.freeDrawingCursor.activate()
    }

    protected doDeactivate(): void {
        toolOptions.funcSetting.func = ''
        this.freeDrawingCursor.deActivate()
    }

    onCommand(cmd: string, options: any) {
        if (!this.attachedUUID) {
            ElMessage.info('请先选择一个操作目标')
            return
        }

        toolOptions.funcSetting.func = cmd
        const new_poly = this.doExcuteCmd(cmd)
        this.updatePoly(new_poly)
    }

    // onKeyZ() {
    //     this.removeLast()
    // }

    onEsc() {
        this.clearData()
        globalStates.subTool = ''
        // this.baseCanva.canvasObj.isDrawingMode = false
    }

    onEnter() {
        // this.doFinishDrawing()
        this.clearData()
        globalStates.subTool = ''
    }

    public setBrushType(type:string) {
        freeDrawOptions.brushType = type
        switch(type) {
            case 'brush':
                break
            case 'erase':
                break
            case '':
                this.clearData()
                break
            default:
                break
        }
    }


    public onWatch() {

        this.watchers.push(
            // 修改brush
            watch(() => freeDrawOptions.brushType, (newValue, oldValue) => {
                this.setBrushType(newValue)
            }, { deep: true })
        )

        this.watchers.push(
            watch(() => poly2dAnnotaterStates.selectedFabricObj, (newValue, oldValue) => {
                if (newValue && newValue !== oldValue) {
                    if (newValue instanceof fabric.Object) {
                        const uuid = newValue.userData?.obj?.uuid
                        this.attach(uuid)
                    }
                }
            })
        )
    }

    onPathCreated(e) {
        this.doFinishDrawing(e.path)
    }

    public bindAutoOffEvents() {
        // this.canvasObj.on('mouse:up', this.onMouseUp)
        // this.canvasObj.on('mouse:down', this.onMouseDown)
        // this.canvasObj.on('mouse:move', this.onMouseMove)
        this.canvasObj.on('path:created', this.onPathCreated)
    }

    public unBindAutoOffEvents() {
        // this.canvasObj.off('mouse:up', this.onMouseUp)
        // this.canvasObj.off('mouse:down', this.onMouseDown)
        // this.canvasObj.off('mouse:move', this.onMouseMove)
        this.canvasObj.off('path:created', this.onPathCreated)
    }

    buildMask(options: any, cb: (img: any, ltwh) => void) {
        const paths = options.paths
        const c = this.baseCanva.canvasObj
        this.baseCanva.canvasObj.cloneWithoutData((cMask) => {
            const { tl, br } = globalStates.imageObject!.aCoords
            const { width, height } = globalStates.imageObject!.getOriginalSize()
            const ltwh = {
                left: tl.x,
                top: tl.y,
                width, height
            }

            // cMask.add()
            cMask.backgroundColor = null

            const interPaths = paths.filter((p) => {
                // o.setCoords()
                const obj = globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID)
                return obj && p.intersectsWithObject(obj)
            })
            if (!interPaths.length) {
                paths.forEach(function (o) {
                    c.remove(o)
                    o.dispose()
                })
                return
            }

            interPaths.forEach(function (o) {
                // c.remove(o)
                o.clone((cloned) => {
                    // cloned.scale(o.zoomX)
                    cMask.add(cloned)
                    c.remove(o)
                    o.dispose()
                })
            })

            paths.forEach(function (o) {
                c.remove(o)
                o.dispose()
            })

            cMask.renderAll()

            const dataURL = cMask.toDataURL({
                format: 'png',
                ...ltwh,
                enableRetinaScaling: false
            })
            if (cb) {
                const base64 = dataURL.substr(22, dataURL.length)
                cb(base64, ltwh)
            }
            cMask.dispose()
        })
    }

    private updatePoly(new_poly) {
        if (!new_poly) {
            return
        }
        const curObj:UserObject | undefined = globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID)
        if (!curObj) return
        const _data = curObj.userData.anno 
        const mask = {
            ..._data,
            val: new_poly,
        } as Poly2d
        set(curObj, 'userData.ownTool', undefined)

        globalStates.mainAnnoater.onMessage(mask).finally(() => {
            globalStates.mainAnnoater.selectObject(this.attachedUUID)
        })
    }

    private doFinishDrawing(path: fabric.Path) {
        this.buildMask({paths:[path]}, (img: any, ltwh: any) => {

            // call wasm
            // img.data Uint8ClampedArray 
            const polys = window.labelHelper.find_polygon_from_dataurl(img, {
                width: ltwh.width,
                height: ltwh.height
            })

            let vals = []
            if (polys.length === 1) {
                vals = polys[0].points
            } else {
                polys.forEach((p) => {
                    if (p.parent === 0) {
                        // 内部洞
                        vals = p.points
                    }
                })
            }

            if (vals.length < 4) {
                return
            }

            // 调用接口，处理数据
            const curObj = globalStates.mainAnnoater.getFabricObjByUuid(this.attachedUUID)
            let new_poly = null
            if (freeDrawOptions.brushType === 'brush') {
                new_poly = window.labelHelper.polygon_union(curObj.userData.anno.val, vals)
            } else if (freeDrawOptions.brushType === 'eraser') {
                new_poly = window.labelHelper.polygon_diff(curObj.userData.anno.val, vals)
            }
            if (Array.isArray(new_poly)) {
                new_poly = new_poly.slice(0, -2) // 移除最后一个点
                this.updatePoly(new_poly)
            }
        })
        globalStates.mainAnnoater.selectObject(this.attachedUUID)
    }

    private clearData() {
        this.unattach()
        this.attachedUUID = undefined
        this.canvasObj.renderAll()
    }
}

export { PolygonEditor }