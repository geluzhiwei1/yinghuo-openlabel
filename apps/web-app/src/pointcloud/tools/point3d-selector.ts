import { AnnoTool } from '@/core/anno-tool'
import * as THREE from 'three'

abstract class Points3DSelector extends AnnoTool {

  polygon: number[][]
  domContainer: HTMLElement

  constructor(domContainer: HTMLElement) {
    super()
    this.polygon = []
    this.domContainer = domContainer
  }

  pushPoint(x:number, y:number) {
    this.polygon.push([x, y])
  }

  deactivate() {
    this.polygon.length = 0
  }
  reset(): void {
    this.polygon.length = 0
  }
}

export { Points3DSelector }