/**
 * @author Zhang Lizhi
 * @email erlingba@qq.com
 * @date 2024年4月11日16:56:01
 * @date 甲辰 [龙] 年 三月初三 上巳节
 */

import { fabric } from 'fabric'
import { Annotater } from './annotater'
import * as _ from 'radash'
import { globalStates } from '@/states'
import type { RenderHelper } from '../RenderHelper'


class ImageCanvas extends Annotater {
    static name = 'imageCanvas'
    static instance: ImageCanvas

    private imageObj: fabric.Image | undefined
    private imageInfo = new fabric.Textbox('', {
        selectable: false,
        editable: false,
        fontSize: 17,
        // strokeWidth: 1,
	    stroke: "gray",
        left: 0,
        top: -30,
        width: 1000
    })
    private zindex: number = 10

    constructor(baseCanva: RenderHelper) {
        super(baseCanva)
        fabric.filterBackend = fabric.initFilterBackend()
        fabric.filterBackend = new fabric.WebglFilterBackend()

        ImageCanvas.instance = this
    }

    public setVisible(visible: boolean) {
        this.imageObj?.set({ visible })
    }

    private ajustImage() {
        if (this.imageObj) {
            // this.imageObj.set({
            //     left: 0,
            //     top: 0,
            //     originX: 'center',
            //     originY: 'center'
            // })
            // this.imageObj.scaleToHeight(this.canvasObj.getHeight() - 4)
            // this.imageObj.center()
            // globalStates.mainAnnoater?.reBuildAllObj()
            // this.canvasObj.viewportCenterObject(this.imageObj)
            const canvas = this.baseCanva.canvasObj
            const { width, height } = this.imageObj.getOriginalSize()
            const scaleRatio = Math.max(width / canvas.getWidth(), height / canvas.getHeight())
            // const p = this.imageObj.getCenterPoint()
            // this.canvasObj.zoomToPoint(p, scaleRatio)
            // canvas.setZoom(1 / scaleRatio)
            // const {tl, br} = this.canvasObj.calcViewportBoundaries()
            // const dimx = (br.x - tl.x - this.imageObj.getScaledWidth()) / 2.0 / scaleRatio
            canvas.viewportTransform = [
                1 / scaleRatio, 0, 0, 
                1 / scaleRatio, 0, 0
            ]
            // canvas.setWidth(canvas.getWidth() * canvas.getZoom())
            // canvas.setHeight(canvas.getHeight() * canvas.getZoom())
            // this.imageObj.center()
        }
        // super.render()
    }

    public setImage(image: HTMLElement, title:string = '') {
        if (!this.imageObj) {
            // 创建对象
            this.imageObj = new fabric.Image(image, {
                left: 0,
                top: 0,
                perPixelTargetFind: true,
                selectable: false
            })
            globalStates.imageObject = this.imageObj
            this.baseCanva.fabricObjects.set(this.zindex + 1, this.imageObj)
            this.baseCanva.fabricObjects.set(this.zindex + 2, this.imageInfo)
            this.ajustImage()
        } else {
            // update
            this.imageObj.setElement(image)
        }

        const imgw = image.naturalWidth || image.width
        const imgH = image.naturalHeight || image.height
        const src = image.src && image.src.startsWith('blob:') ? 'blob' : image.src.substring(0, 100) + '..'
        this.imageInfo.set({
            text: `${title} Width:${imgw}, Height:${imgH}, URL:${src}`,
        })
    }

    // public setImage(image: HTMLElement) {
    //     if (this.imageObj) {
    //         // this.canvasObj.remove(this.imageObj)
    //         this.imageObj.dispose()
    //     }

    //     this.imageObj = new fabric.Image(image, {
    //         left: 0,
    //         top: 0,
    //         // perPixelTargetFind: true,
    //         selectable: false
    //     })
    //     _.set(this.imageObj, 'filters', [])
    //     globalStates.imageObject = this.imageObj

    //     // this.canvasObj.add(this.imageObj)
    //     // this.canvasObj.insertAt(this.imageObj, 0, false)
    //     this.baseCanva.fabricObjects.set(this.zindex + 1, this.imageObj)
    //     this.ajustImage()
    // }

    /**
     * pos: [x, y]
     * 图像上的坐标转为在canvas上的坐标
     */
    public pointOnImageToCanvas(x: number, y: number) {
        if (this.imageObj) {
            // this.imageObj.toCanvasCoords(pointOnImage)
        }
    }

    public reset() {
        this.ajustImage()
        if (this.imageObj) {
            this.baseCanva.reRenderAll()
        }
    }

    public render() {
    }

    public getImageEle() {
        return this.imageObj?.getElement()
    }

    public filterImage(imgAttribute: object) {
        if (!this.imageObj) {
            return
        }
        const f = fabric.Image.filters

        const filterNames = ['contrast', 'saturation',
            'brightness', 'hue', 'pixelate', 'grayscale', 'blackwhite'];

        const buildFilter = (filterName: string) => {
            switch (filterName) {
                case 'contrast':
                    return new f.Contrast({ contrast: 0 })
                case 'saturation':
                    return new f.Saturation({ saturation: 0 })
                case 'brightness':
                    return new f.Brightness({ brightness: 0 })
                case 'hue':
                    return new f.HueRotation({ rotation: 0 })
                case 'pixelate':
                    return new f.Pixelate({ blocksize: 0 })
                case 'grayscale':
                    return new f.Grayscale({ mode: 'average' })
                case 'blackwhite':
                    return new f.BlackWhite()
                default:
                    // throw new Error('filter not found')
                    return {};
            }
        }

        const applyFilter = (filterName: string, prop: string, value: any) => {
            if (!this.imageObj) {
                return
            }
            const index = filterNames.indexOf(filterName)
            if (!this.imageObj.filters[index]) {
                this.imageObj.filters[index] = buildFilter(filterName)
            }
            if (prop) {
                this.imageObj.filters[index][prop] = value
            }

            this.imageObj.applyFilters()
        }

        const removeFilter = (filterName: string) => {
            if (!this.imageObj) {
                return
            }
            const index = filterNames.indexOf(filterName)
            delete this.imageObj.filters[index]

            this.imageObj.applyFilters()
        }

        _.mapEntries(imgAttribute.filterValues, (key: string, val: any) => {
            if (val.enabled) {
                applyFilter(key, val.prop, val.value)
            } else {
                removeFilter(key)
            }
            return [key, val]
        })

        this.canvasObj.renderAll()
    }

    public imageSize() {
        return this.imageObj!.getOriginalSize()
    }

    public dataURLToBlob(dataURL: string) {
        const arr = dataURL.split(',')
        const mime = arr[0].match(/:(.*?);/)![1]
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
        }
        return new Blob([u8arr], { type: mime })
    }

    public getImageObj(): fabric.Image {
        return this.imageObj
    }

    public getImageBlob(): Blob {
        const imgFb = this.getImageObj()! as fabric.Image
        const dataURL = imgFb.toDataURL(
            {
                format: 'jpeg',
                quality: 1,
                enableRetinaScaling: false,
            }
        )
        const imgBlob = this.dataURLToBlob(dataURL)
        return imgBlob
    }
}

export { ImageCanvas }