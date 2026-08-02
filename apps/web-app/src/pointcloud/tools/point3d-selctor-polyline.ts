import { Points3DSelector } from './point3d-selector'
import { eventBus } from '../event/EventBus'
import { reactive, watch } from 'vue'
import { jobConfig } from '@/states/job-config'

class Points3DSelectorPolyline extends Points3DSelector {
  static Name = 'points3DSelectorPolyline'
  public states = reactive({
      activated: false,
  })
  static instance: Points3DSelectorPolyline

  constructor(domContainer: HTMLElement = document.body) {
    super(domContainer)
    this.mousemove = this.mousemove.bind(this)
  }

  private watchers = [] as any[]
  private bindAutoOffEvents() {
      this.domContainer?.addEventListener('mousemove', this.mousemove)
      // this.watchers.push(
      //     watch(() => jobConfig.frame, (v) => {
      //     })
      // )
  }

  private unBindAutoOffEvents() {
      // this.domContainer?.removeEventListener('mouseup', this.mouseup)
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

  mousemove(event: MouseEvent) {
    if (event.ctrlKey || event.shiftKey || event.altKey) {
      this.pushPoint(event.offsetX, event.offsetY)
    }
  }
}


eventBus.on(eventBus.pcEditor.Inited, () => {
  Points3DSelectorPolyline.instance = 
  new Points3DSelectorPolyline(document.getElementById('m-view-manipulator') as HTMLElement)
})

export { Points3DSelectorPolyline }