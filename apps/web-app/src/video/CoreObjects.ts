class CoreObjects {
    /**
     * canvas html elements
     */
    public canvasEle: HTMLElement | null = null
    /**
     * canvasEle的父元素，用于放置额外的控件
     */
    public canvasParentEle: HTMLElement | null = null

    /**
     * 当前画布上的所有对象，绘制的时候根据number排序
     */
    public fabricObjects: Map<number, any> | null = null
    /**
     * fabric canvas对象
     */
    public canvasObj:fabric.Canvas | null = null

}

const coreObjects = new CoreObjects()

export { coreObjects }