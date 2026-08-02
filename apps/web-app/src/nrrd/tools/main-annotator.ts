import { globalStates } from '@/states'
import { eventBus } from '../event-bus'
import { reactive, watch } from 'vue';
import { UndoRedoStack } from '@/libs/undoRedoStack'
import colormap from 'colormap'
import Color from 'color'
import { set, clone } from 'radash'
import _ from 'lodash'
import { Box3dTool } from '../tools/box3d-tool'
// import { PolylineTool } from './polyline-tool'
// import { MouseSelectTool } from './MouseSelectTool'
import { uiState } from '@/states/UiState';
import { glObjectState } from '../render/state';


export const hotBarOptions = reactive({
    enabled: true,
    visible: false,
    style: {
      top: 0 + 'px',
      left: 0 + 'px',
      position: 'absolute',
      // justifyContent: 'center',
      // alignItems: 'center',
      width: '100%'
    },
    copiedDatas: {} // 支持工具栏复制粘贴
})

export const annotaterStates = reactive({
    setting: {
      objTypes: ['default'] as string[] // 类别名
    },
    // selectedObject: undefined as Poly2d | undefined,
    selected: {}, //_.cloneDeep(defaultCuboidBox) as CuboidBoxPSR,
    defaultObjType: 'default' as string,
    rebuildByUUID: '',
    auxiliaryFrames: [], // 要显示的辅助帧
})

const defaultSettingFormData = {
    settings: {},
    defaultObjType: {
      stroke: 'white',
      strokeWidth: 1,
      fill: 'rgba(0,0,55,0.1)'
    },
    theOthersObjType: {
      stroke: 'red',
      strokeWidth: 1,
      fill: 'rgba(55,0,0,0.1)'
    },
  }
export const polylineAnnotaterSetting = reactive({
      ...clone(defaultSettingFormData)
  })

class MainAnnotator {
    private static instance: MainAnnotator;
    private constructor() {
      this.onWatch()
    }
    protected watchers: any[] = []
    public undoRedo = new UndoRedoStack<Map<string, fabric.Object>>(5)
    private copiedObjects: Map<number, [any]> = new Map()
    public deletedObjs: Map<string, any> = new Map()
    
    protected offWatch() {
        this.watchers.forEach((unwatch) => {
            unwatch()
        })
        this.watchers = []
    }
    public static getInstance(): MainAnnotator {
        if (!this.instance) {
            this.instance = new MainAnnotator();
        }
        return this.instance
    }

    /**
     * 状态，外部监听
     */
    public publicStates = reactive({
        /**
         * 对象更新了，可能需要重新渲染
         */
        objectsUpdated: 0,
        /**
         * 样式更新了，可能需要重新渲染
         */
        objStylesUpdated: 0,
        /**
         * 对象tag更新了，可能需要重新渲染
         */
        objectsTagsUpdated: 0,
    })

    public onWatch() {
        this.watchers.push(
          // 改变类别
          watch(
            () => annotaterStates.selected.objType,
            (newVal, oldVal) => {
              annotaterStates.defaultObjType = newVal
              // 更新当前对象的样式
              const selected = annotaterStates.selected
              if (selected.type && this.objStyles.get(newVal)) {
                if (selected.isType('group')) {
                  for (let i = 0; i < selected.size(); i++) {
                    const o = selected.item(i)
                    if (o.isType('polygon') && 'polygon' === get(o, 'userData.userType', undefined)) {
                      o.set({
                        ...this.objStyles.get(newVal).options
                      })
                    }
                  }
                } else {
                  selected.set({
                    ...this.objStyles.get(newVal).options
                  })
                }
              }
            }
          )
        )
    
        this.watchers.push(
          // 类别发生变化
          watch(
            () => annotaterStates.setting.objTypes,
            (newVal, oldVal) => {
              if (annotaterStates.setting.objTypes.length > 1) {
                // 设置颜色空间
                const fillColors = colormap({
                  colormap: 'rainbow',
                  nshades:
                    annotaterStates.setting.objTypes.length < 9
                      ? 9
                      : annotaterStates.setting.objTypes.length,
                  format: 'rgbaString',
                  alpha: 0.1
                })
                annotaterStates.setting.objTypes.forEach((objType, index) => {
                  this.objStyles.set(objType, {
                    options: {
                      fill: fillColors[index]
                    }
                  })
                })
    
                this.publicStates.objStylesUpdated += 1
              }
            }
          )
        )
    
        this.watchers.push(
          watch(
            () => polylineAnnotaterSetting.settings.hideAllLabels,
            (newVal, oldVal) => {
              if (newVal === oldVal) return
              if (newVal) {
                this.setVisible(false)
              } else {
                this.setVisible(true)
              }
              this.canvasObj.requestRenderAll()
            }
          )
        )

        this.watchers.push(
          watch(
            () => globalStates.mainTool,
            (newVal, oldVal) => {
              this.setCurrentTool(newVal)
            })
      )
      }

    setCurrentTool(tool: string) {
        switch (tool) {
          case 'default':
          case Box3dTool.Name:
            // MouseSelectTool.getInstance().deactivate()
            Box3dTool.getInstance().activate()
            // PolylineTool.getInstance().deactivate()
            break
          // case PolylineTool.Name:
          //   MouseSelectTool.getInstance().deactivate()
          //   Box3dTool.getInstance().deactivate()
          //   PolylineTool.getInstance().activate()
          //   break
          default:
            break
        }
    }

    private objStyles: Map<string, any> = new Map([
        [
          'default',
          {
            options: {
              fill: 'rgba(55,0,0,0.1)'
            }
          }
        ]
      ])
      public objectsStyles() {
        return this.objStyles
      }
      public updateCategoryStyle(category: string, conf: any) {
        this.objStyles.set(category, { ...conf })
      }
      public copyTo(cmd:string) {
        const o = this.getSelectedObject()
        if (!o) return
        switch(cmd) {
          case 'copyToNext':
            {
              const obj = this.convertFabricObjectToObj(o)
              if (!obj) return
              // clean obj
              obj.uuid = undefined
              obj.op_log = []
              obj.attributes.op_type = 'create'
              const nextFrame = jobConfig.frame + 1
              if (this.copiedObjects.has(nextFrame)) {
                this.copiedObjects.get(nextFrame)?.push(obj)
              } else {
                this.copiedObjects.set(nextFrame, [obj])
              }
              // ElMessage.success(`已拷贝到下一帧`)
              commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
            }
            break
          case 'copyToLast':
            {
              const obj = this.convertFabricObjectToObj(o)
              if (!obj) return
              // clean obj
              obj.uuid = undefined
              obj.op_log = []
              obj.attributes.op_type = 'create'
              const nextFrame = jobConfig.frame - 1
              if (this.copiedObjects.has(nextFrame)) {
                this.copiedObjects.get(nextFrame)?.push(obj)
              } else {
                this.copiedObjects.set(nextFrame, [obj])
              }
              // ElMessage.success(`已拷贝到上一帧`)
              commonChannel.pub(commonChannel.Events.ChangingFrame, { data: { id: nextFrame } })
            }
            break
          default:
            break
        }
      }
    
      private readCopyedObjects() {
        if (this.copiedObjects.has(jobConfig.frame)) {
          this.import('default', this.copiedObjects.get(jobConfig.frame))
          this.copiedObjects.delete(jobConfig.frame)
        }
      }

      
  public cleanData() {
    this.setselected(undefined)
    // 从canvas中删除
    this.objects?.forEach((obj) => {
      this.baseCanva.fabricObjects.delete(obj.userData.zIndex)
      obj?.dispose()
    })

    this.seqGener.reset()
    this.objects.clear()
    this.baseCanva.reRenderAll()

    this.publicStates.objectsUpdated += 1

    this.readCopyedObjects()
  }

  public doDeleteObj(obj) {
    if (!obj) {
      return
    }

    glBoxAnnotationManager.getCurrent()?.remove(obj, false)

    this.deletedObjs.set(obj.uuid, obj)

    this.publicStates.objectsUpdated += 1
  }
  
  private hoBarWithin(target: any) {
    if (!target) {
      hotBarOptions.visible = false
      return
    }
    if (globalStates.subTool !== "") {
      hotBarOptions.visible = false
      return
    }
    if (target instanceof fabric.Object) {
      target.setCoords()
      hotBarOptions.style.left = target.oCoords.tl.x + 'px'
      hotBarOptions.style.top = target.oCoords.tl.y - 35 + 'px'
      hotBarOptions.visible = true
    }
  }
  public removeSelected() {
    if (annotaterStates.selected) {
      const obj = annotaterStates.selected
      this.doDeleteObj(obj)
    }
  }
    public export(format:string='default') {
        const annos = glBoxAnnotationManager.getCurrent()?.toJson()
        if (format === 'createOrUpdated') {
          return annos.filter((anno) => {
              return anno.attributes?.op_type
          })
        }
        return annos
    }

    public import(format:string='default', annos:any[]) {
      const filterd = annos.filter((anno) => {
        if (anno) return anno
      })
        glBoxAnnotationManager.getCurrent()?.fromJson(filterd)
        this.publicStates.objectsUpdated += 1
    }

    /**
     * 获取当前帧已经标注的对象
     * @returns 
     */
    public objectsMap() {
        return glBoxAnnotationManager.getCurrent()?.getGlBoxes()
    }
}

globalStates.mainAnnoater = MainAnnotator.getInstance()


watch(
  [() => uiState.mounted],
  (val) => {
    globalStates.mainTool = 'default'
  }
)

export { MainAnnotator }
