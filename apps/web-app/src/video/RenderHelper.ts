import { coreObjects } from './CoreObjects'

class RenderHelper {
    public canvasObj
    public canvasEle: HTMLElement
    public containerEle

    public isDragging = false
    /**
     * 当前画布上的所有对象，绘制的时候根据number排序
     */
    public fabricObjects: Map<number, any>

    private lastPosX = 0.0
    private lastPosY = 0.0
    private activated = false

    private _fabricEvents: Map<string, any[]>


    constructor() {
        this.containerEle = coreObjects.canvasParentEle
        this.canvasEle = coreObjects.canvasEle

        this.canvasObj = new fabric.Canvas(coreObjects.canvasEle, {
            hoverCursor: 'default',
            selection: false,
            fireRightClick: true,
            // fireMiddleClick: true,
            // centeredRotation: true,
            // centeredScaling: true,
            // preserveObjectStacking: true,
        })

        this._fabricEvents = new Map()
        this.fabricObjects = new Map()

        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onMouseWheel = this.onMouseWheel.bind(this)
    }

    public on(eventName: string, callback: (...args: any[]) => void) {
        const eventsArr = this._fabricEvents.get(eventName) || []
        if (!eventsArr.some((cb) => cb === callback)) {
            this._fabricEvents.set(eventName, [callback, ...eventsArr])
        }
    }
    public off(eventName: string, callback: (...args: any[]) => void) {
        const eventsArr: any[] | undefined = this._fabricEvents.get(eventName);
        if (eventsArr) {
            this._fabricEvents.set(
                eventName,
                eventsArr.filter((cb: () => void) => cb !== callback)
            )
        }
    }
    public emit(eventName: string, ...args: any[]) {
        this.dispatch(eventName, ...args)
    }
    private dispatch(eventName: string, ...args: any[]) {
        const callbacks = this._fabricEvents.get(eventName)
        if (callbacks) {
            callbacks.forEach((cb) => {
                if (cb) {
                    cb(...args)
                }
            })
        }
    }

    private bindAutoOffEvents() {
        this.canvasObj.on('mouse:down', this.onMouseDown)
        this.canvasObj.on('mouse:up', this.onMouseUp)
        this.canvasObj.on('mouse:move', this.onMouseMove)
        this.canvasObj.on('mouse:wheel', this.onMouseWheel)
    }

    private unBindAutoOffEvents() {
        this.canvasObj.off('mouse:down', this.onMouseDown)
        this.canvasObj.off('mouse:up', this.onMouseUp)
        this.canvasObj.off('mouse:move', this.onMouseMove)
        this.canvasObj.off('mouse:wheel', this.onMouseWheel)
    }

    private setCursor() {
        if (this.isDragging) {
            this.canvasObj.setCursor('move')
        } else {
            this.canvasObj.setCursor('default')
        }
    }

    protected doActivate() { }
    public activate() {
        if (this.activated) {
            return
        }
        this.bindAutoOffEvents()
        this.doActivate()
        this.activated = true
    }

    protected doDeactivate() { }
    public deactivate() {
        if (!this.activated) {
            return
        }
        this.unBindAutoOffEvents()
        this.doDeactivate()
        this.activated = false
    }

    public onMouseDown(options: any) {
        const evt = options.e
        if (evt.button === 2) {
            // 右键
            this.isDragging = true
            this.lastPosX = evt.clientX
            this.lastPosY = evt.clientY
        }
        this.dispatch("mouse:down", options)
    }

    public onZoomChange() {
        const w = 1
        const strokeWidth = w / this.canvasObj.getZoom()
        for (const object of this.canvasObj.getObjects()) {
            if (object.type === 'path') {
                continue
            }
            object.set('strokeWidth', strokeWidth)
        }
    }

    public onMouseWheel(opt: any) {
        const delta = opt.e.deltaY
        let zoom = this.canvasObj.getZoom()
        zoom *= 0.999 ** delta
        if (zoom > 20) zoom = 20
        if (zoom < 0.01) zoom = 0.01
        this.canvasObj.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)
        this.onZoomChange()

        // opt.e.preventDefault()
        // opt.e.stopPropagation()
        this.dispatch("mouse:wheel", opt)
        this.canvasObj.renderAll()
    }

    public onMouseUp(opt: any) {
        this.isDragging = false
        this.setCursor()
        // this.dispatch("mouse:up", opt)
    }

    public onMouseMove(opt: any) {
        if (this.isDragging) {
            const e = opt.e;
            const vpt = this.canvasObj.viewportTransform
            vpt[4] += e.clientX - this.lastPosX
            vpt[5] += e.clientY - this.lastPosY
            // this.canvasObj.requestRenderAll()
            this.lastPosX = e.clientX
            this.lastPosY = e.clientY
            this.dispatch("canvas:pan", opt)

            // this.canvasObj.requestRenderAll()
            this.canvasObj.renderAll()
        }
        this.setCursor()
        // this.dispatch("mouse:move", opt)
    }

    public resize(width: number, height: number) {
        this.canvasObj.setDimensions({ width, height })
    }

    public reRenderAll() {
        this.dispatch("render:all")
    }

    public render() {
        this.canvasObj.renderAll()
    }

    public onMessage(...args: any[]) {

    }

    public rotate(degrees: number, center: fabric.Point) {
        // const canvasCenter = new fabric.Point(this.canvasObj.getWidth() / 2, this.canvasObj.getHeight() / 2) // center of canvas
        const radians = fabric.util.degreesToRadians(degrees)
        this.canvasObj.getObjects().forEach((obj) => {
            const objectOrigin = new fabric.Point(obj.left, obj.top)
            const new_loc = fabric.util.rotatePoint(objectOrigin, center, radians)
            obj.top = new_loc.y
            obj.left = new_loc.x
            obj.angle += degrees //rotate each object by the same angle
            obj.setCoords()
        });
        this.canvasObj.renderAll()
    }
}

export { RenderHelper }