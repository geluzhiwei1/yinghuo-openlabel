import { Points3DSelector } from './point3d-selector'
import { eventBus } from '../event/EventBus'
import { reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'

class Points3DSelectorCircle extends Points3DSelector {
  static Name = 'points3DSelectorCircle'
  public states = reactive({
      activated: false,
  })
  static instance: Points3DSelectorCircle

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
      const precision = 64
      const PI2 = Math.PI * 2
      const ox = this.startX
      const oy = this.startY
      const nx = event.offsetX
      const ny = event.offsetY

      const r = Math.sqrt((nx - ox) * (nx - ox) + (ny - oy) * (ny - oy))
      for (let a = 0; a < PI2; a += PI2 / precision) {
        this.pushPoint(ox + r * Math.cos(a), oy - r * Math.sin(a))
      }
    }
  }
}


eventBus.on(eventBus.pcEditor.Inited, () => {
  Points3DSelectorCircle.instance = 
  new Points3DSelectorCircle(document.getElementById('m-view-manipulator') as HTMLElement)
})

export { Points3DSelectorCircle }