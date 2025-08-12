/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月11日16:50:39
 * @date 甲辰 [龙] 年 三月初三 上巳节
 */
import { ImageCanvas } from './annotaters/imageCanvas'
import { HelperLineAnnotater } from './annotaters/helperLineAnnotater'
import { RenderHelper } from './RenderHelper'
import { globalStates } from '@/states'
import _ from 'lodash'
import { AnnoRegistry } from '@/video/annotaters/all-tools'
import { coreObjects } from './CoreObjects'


class Toolsets {
    public constructor() {
    }

    private createSubCanvas(divElement: HTMLElement) {
        ;
    }

    private toolsMap = new Map()
    private exclusiveTools: string[] = new Array()
    public renderHelper: RenderHelper
    /**
     * 按照顺序创建tool， 并执行activate
     * @param containerId 
     * @param toolset 
     */
    public init(containerId: string,
        mainTool: string, subTools: string[], toolsSettings: any) {

        const toolset = [mainTool, ...subTools]

        const containerEle = document.getElementById(containerId)
        if (!containerEle) {
            throw new Error('container element not found')
        }

        // 创建canvas
        const canvasEle = document.createElement('canvas')
        canvasEle.id = `${containerId}Canvas`
        const divElement = document.createElement('div')
        divElement.id = `${containerId}Div`
        divElement.appendChild(canvasEle)
        // sub canvas
        this.createSubCanvas(divElement)
        containerEle.appendChild(divElement)

        // 保存全局变量，方便在其他地方使用
        coreObjects.canvasEle = canvasEle
        coreObjects.canvasParentEle = divElement

        this.renderHelper = new RenderHelper()
        this.renderHelper.activate()

        // 实例化相关工具, set name
        AnnoRegistry.forEach((conf, toolName) => {
            if (toolset.includes(toolName)) {
                const t = new conf.ToolClass(this.renderHelper)
                t.name = toolName
                t.setConf(toolsSettings[toolName]) // 初始配置
                this.toolsMap.set(toolName, t)

                if (mainTool === toolName) {
                    globalStates.mainAnnoater = t
                }
            }
        })
        this.toolsMap.set(ImageCanvas.name, new ImageCanvas(this.renderHelper))
        this.toolsMap.get(ImageCanvas.name).name = ImageCanvas.name
        this.toolsMap.set(HelperLineAnnotater.name, new HelperLineAnnotater(this.renderHelper))
        this.toolsMap.get(HelperLineAnnotater.name).name = HelperLineAnnotater.name

        this.render = this.render.bind(this)
        this.renderHelper.on('render:all', () => {
            this.render()
        })

        globalStates.toolsInited = true
        globalStates.subTool = ''
    }

    // /**
    //  * 仅仅激活一个
    //  * @param tool 
    //  */
    // public activateSingle(tool: string) {
    //     this.get(tool)?.activate()
    //     // this.get(tool)?.render()
    //     this.toolsMap.forEach((toolObj, key) => {
    //         if (key !== tool) {
    //             toolObj.deactivate()
    //         }
    //     })
    // }

    // /**
    //  * 互斥，不可同时启用
    //  * @param the 
    //  * @param others 
    //  */
    // private selectTheOthers(the: string) {
    //     this.get(the)?.activate()
    //     this.exclusiveTools.forEach((tool) => {
    //         if (tool !== the) {
    //             this.get(tool)?.deactivate()
    //         }
    //     })
    // }

    // /**
    //  * 切换activate状态
    //  * @param tool 
    //  */
    // public toggle(tool: string) {
    //     const toolObj = this.get(tool)
    //     if (toolObj.activated === false) {
    //         toolObj.activate()
    //     } else {
    //         toolObj.deactivate()
    //     }
    // }

    public get(tool: string) {
        return this.toolsMap.get(tool)
    }

    public resize(width: number, height: number) {
        this.renderHelper.resize(width, height)
        this.toolsMap.forEach((toolObj, key) => {
            toolObj.resize()
        })
        this.renderHelper.canvasObj.requestRenderAll()
    }

    public renderAll() {
        this.renderHelper.canvasObj.renderAll()
    }

    public render() {
        this.renderHelper.canvasObj.clear()
        const keys = new Array()
        this.renderHelper.fabricObjects.forEach((v, k) => {
            keys.push(k)
        })
        const sorted = _.sortBy(keys)
        sorted.forEach((o) => {
            this.renderHelper.canvasObj.add(this.renderHelper.fabricObjects.get(o))
        })
        this.toolsMap.get('imageCanvas')?.render()
        this.toolsMap.get('bboxBuilder')?.render()
        this.renderHelper.render()
    }
}

export { Toolsets }