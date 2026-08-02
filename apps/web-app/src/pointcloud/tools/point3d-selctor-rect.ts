import { Points3DSelector } from './point3d-selector'
import { eventBus } from '../event/EventBus'
import { reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'

class Points3DSelectorRect extends Points3DSelector {
  static Name = 'points3DSelectorRect'
  public states = reactive({
      activated: false,
  })
  static instance: Points3DSelectorRect

  startX = NaN
  startY = NaN

  constructor(domContainer: HTMLElement = document.body) {
    super(domContainer)

    this.mouseup = this.mouseup.bind(this)
    this.mousemove = this.mousemove.bind(this)
    // this.pointerdown = this.pointerdown.bind(this)
    // this.onEscUp = this.onEscUp.bind(this)
  }

  private watchers = [] as any[]
  private bindAutoOffEvents() {
      this.domContainer?.addEventListener('mouseup', this.mouseup)
      this.domContainer?.addEventListener('mousemove', this.mousemove)
      // this.domContainer?.addEventListener('pointerdown', this.pointerdown)
      // this.watchers.push(
      //     watch(() => jobConfig.frame, (v) => {
      //         // 取消选择
      //         // eventBus.emit(eventBus.PolylineAnnotation.SelectedChanged, {
      //         //     intersections:[], command: 'cancel',
      //         // })
      //     })
      // )
  }

  private unBindAutoOffEvents() {
      this.domContainer?.removeEventListener('mouseup', this.mouseup)
      this.domContainer?.removeEventListener('mousemove', this.mousemove)
      // this.domContainer?.removeEventListener('pointerdown', this.pointerdown)
      this.watchers.forEach(unwatch => unwatch())
  }

  activate() {
    this.bindAutoOffEvents()
    this.states.activated = true
  }

  deactivate(): void {
    this.unBindAutoOffEvents()
    this.states.activated = false
    super.deactivate()
  }

  toggle(enable: boolean) {
    if (enable) {
      this.activate()
    } else {
        this.deactivate()
    }
  }

  // pointerdown(ev) {
  //   if (ev.which == 3) {
  //     this.pushPoint(ev.offsetX, ev.offsetY)
  //     this.startX = ev.offsetX
  //     this.startY = ev.offsetY
  //   }
  // }

  mouseup(event: MouseEvent) {
    if (event.ctrlKey || event.shiftKey) {
      this.pushPoint(event.offsetX, event.offsetY)
      this.startX = event.offsetX
      this.startY = event.offsetY
      // eventBus.emit(eventBus.Points3DAnnotation.ToSelectPoints, {
      //   data: this.polygon, command: 'ToSelectPoints',
      // })
      // this.polygon.length = 0
      // this.startX = this.startY = NaN
    }
  }

  mousemove(event: MouseEvent) {
    if (event.ctrlKey || event.shiftKey) {
      this.polygon.length = 0
      const fx = this.startX
      const fy = this.startY
      this.pushPoint(fx, fy)
      this.pushPoint(event.offsetX, fy)
      this.pushPoint(event.offsetX, event.offsetY)
      this.pushPoint(fx, event.offsetY)
      this.pushPoint(fx, fy)
    }
  }
}


eventBus.on(eventBus.pcEditor.Inited, () => {
  Points3DSelectorRect.instance = 
  new Points3DSelectorRect(document.getElementById('m-view-manipulator') as HTMLElement)
})

export { Points3DSelectorRect }