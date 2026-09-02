import { eventBus } from '../event/EventBus'
import * as THREE from 'three'
import { glGlobals } from './GlObjectsHolder'
import _ from 'lodash'
import { pySeqData } from '../api'
import { calcPointCloudColor } from '../utils/colormap'
import { jobConfig } from '@/states/job-config'
import { glObjectState, pcUserSettings } from '@/pointcloud/states'
import { watch } from 'vue'
import type { PCDFormat } from '@/types/data-format'

class GlPointcloud {

  private streamId: string
  private ts: number
  private frame: number
  private pcd: PCDFormat

  pcdMesh: THREE.Points

  // 点的label
  pointLabels: Set<string> = new Set()
  // label -> points index
  labelToPoints: Map<string, Set<number>> = new Map()
  labelToColor: Map<string, number[]> = new Map()
  defaultLabelColor: number[] = [0.0, 0.0, 1.0]
  colorArr: number[] = []

  constructor(pointsObject: PCDFormat, streamId: string, ts: number, frame: number) {
    this.streamId = streamId
    this.ts = ts
    this.frame = frame
    this.pcd = pointsObject

    // 增加默认的label：选中的点显示为红色
    this.updateLabelColor('selected', [1.0, 0.0, 0.0])

    this.buildMesh()
  }

  public updatePointVisible(params: { points: number[]; visible: boolean }) {
    if (!params.visible) {
      for (let i = 0; i < params.points.length; i++) {
        const pos = params.points[i]
        this.pcdMesh.geometry.getAttribute('position').setXYZ(pos, 1e20,1e20,1e20)
      }
    } else {
      for (let i = 0; i < params.points.length; i++) {
        const pos = params.points[i]
        const start = pos * 3
        // const arr = this.pcdMesh.geometry.getAttribute('position').array
        // arr[start] = this.pcd.position[start]
        // arr[start + 1] = this.pcd.position[start + 1]
        // arr[start + 2] = this.pcd.position[start + 2]

        this.pcdMesh.geometry.getAttribute('position').setXYZ(pos, this.pcd.position[start], this.pcd.position[start + 1], this.pcd.position[start + 2])
      }
    }
    this.pcdMesh.geometry.attributes.position.needsUpdate = true
  }

  public setSelectedPoints(selected: number[]) {
    this.updateLabelPoints('selected', selected)
  }

  public updateLabelPoints(label: string, points: number[]) {
    this.labelToPoints.set(label, new Set(points))

    // 更新颜色
    this.colorPoints()
  }

  public updateLabelsPoints(params: { label: string; points: number[]; pointColor: number[]}[]) {
    for (let i = 0; i < params.length; i++) {
      const {label, points, pointColor} = params[i]
      if (pointColor && pointColor.length === 3) {
        this.updateLabelColor(label, pointColor)
      }
      this.labelToPoints.set(label, new Set(points))
    }
    // 更新颜色
    this.colorPoints()
  }

  public updateLabelColor(label: string, color: number[]) {
    this.pointLabels.add(label)
    if (this.labelToPoints.has(label)) {
      ;
    } else {
      this.labelToPoints.set(label, new Set())
    }
    this.labelToColor.set(label, color)
  }

  // private buildColor() {
  //   const { pcd } = this
  //   let color = [] as number[]
  //   if (pcd.rgb && pcd.rgb.length > 0) {
  //     color = pcd.rgb
  //   } else {
  //     color.length = pcd.position.length
  //     color.fill(pcUserSettings.value.setting.pointBrightness)
  //   }
  //   return color
  // }

  public buildMesh() {
    const { pcd } = this
    const position = pcd.position
    const geometry = new THREE.BufferGeometry()
    if (position.length > 0) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
    }

    const color = [] as number[]
    color.length = pcd.position.length
    color.fill(pcUserSettings.value.setting.pointBrightness)

    const colorAttribute = new THREE.Float32BufferAttribute(color, 3)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('color', colorAttribute)

    geometry.computeBoundingSphere()

    const material = new THREE.PointsMaterial({
      size: pcUserSettings.value.setting.pointSize,
      vertexColors: true
    })

    material.sizeAttenuation = false

    const mesh = new THREE.Points(geometry, material)
    mesh.name = glGlobals.buildPcdMeshName(jobConfig)
    mesh.userData = {
      pcMeta: {
        ts: this.ts,
        frame: this.frame,
        streamId: this.streamId,
        pointCount: pcd.position.length / 3,
      }
    }

    // if (jobConfig.data_format === 'openlabel') {
    //   if (dataSeqState?.streamMeta?.openlabel) {
    //     if(dataSeqState.streamMeta.openlabel.frames[jobConfig.frame].frame_properties.type === 'map') {
    //       mesh.matrixAutoUpdate = false
    //       mesh.matrixWorldAutoUpdate = false
    //     }
    //   }
    // }

    this.pcdMesh = mesh

    const glSensorGroup = glGlobals.getSensorGroup({frame:this.frame, stream: this.streamId, ts:this.ts})
    glSensorGroup.add(mesh)

    const currentFrameGroup: THREE.Group = glGlobals.getEgoGroup(this.frame)
    currentFrameGroup.add(glSensorGroup)
    // currentFrameGroup.matrix.setPosition(315968135.259768,-163.74353309751993,2319.9352284684605)
    // currentFrameGroup.matrixWorldNeedsUpdate = true

    eventBus.emit(eventBus.Box3d.SelectedChanged)
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  updatePointsSize() {
    this.pcdMesh.material.size = pcUserSettings.value.setting.pointSize
    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }

  /**
   * 新加载的点云与相机尺度悬殊(云的包围球半径 > 相机距离 5 倍,或反之)时,
   * 沿当前视线把相机退到能装下整朵云的距离。
   *
   * 地理参考坐标的 LAS/LAZ 平移到原点后半径仍可达数公里,而相机默认在
   * (0,0,50)、fov 75°,可见点只有个位数,页面看起来就是空的;靠滚轮把
   * OrbitControls 从 50m 缩放到 ~5km 要上百格。只在悬殊时干预,正常同尺度
   * 的序列帧(相机距离与云半径同量级)不受影响。
   */
  fitCameraToCloud() {
    const mainView: any = glGlobals.mainView
    if (!mainView?.camera || !mainView?.orbitControl) return
    const bs = this.pcdMesh.geometry.boundingSphere
    if (!bs || !Number.isFinite(bs.radius) || bs.radius <= 0) return

    const camera: THREE.PerspectiveCamera = mainView.camera
    const center = bs.center.clone()
    const dir = camera.position.clone().sub(center)
    const dist = dir.length()
    if (dist > 0) dir.normalize()
    else dir.set(0, 0, 1)

    if (bs.radius <= dist * 5 && dist <= bs.radius * 5) return

    const fov = (camera.fov * Math.PI) / 180
    const need = (bs.radius / Math.sin(fov / 2)) * 1.2
    camera.position.copy(center).addScaledVector(dir, need)
    if (camera.far < need + bs.radius) {
      camera.far = (need + bs.radius) * 2
      camera.updateProjectionMatrix()
    }
    mainView.orbitControl.target.copy(center)
    mainView.orbitControl.update()
  }

  updateColor() {
    const colorAttribute = new THREE.Float32BufferAttribute(this.colorArr, 3)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)
    this.pcdMesh.geometry.setAttribute('color', colorAttribute)
  }

  setPointColor(idx: number, color:number[]) {
    const st = idx * 3
    this.colorArr[st] = color[0]
    this.colorArr[st + 1] = color[1]
    this.colorArr[st + 2] = color[2]
  }

  setPointsColor(idxes: number[], color = []) {
    for(const idx of idxes) {
      this.setPointColor(idx, color)
    }
  }

  doColorByLabel(label: string) {
    const points = this.labelToPoints.get(label)
    if (points && points.size > 0) {
      let color = this.labelToColor.get(label)
      if (!color) {
        color = this.defaultLabelColor
      }
      for (const idx of points) {
        this.setPointColor(idx, color)
      }
    }
  }

  /**
   * 根据点的lable更新点的颜色
   */
  colorByLabels() {
    for (const label of this.pointLabels) {
      this.doColorByLabel(label)
    }

    // selected 点单独处理
    this.doColorByLabel('selected')
  }

  public async colorPoints() {
    let colorArr = [] as  number[] // this.pcdMesh.geometry.getAttribute('color').array
    if (pcUserSettings.value.setting.colorPoints === 'colorMapping') {
      let arr = null
      switch (pcUserSettings.value.setting.colorPointsSetting.field) {
        case 'intensity':
          if (this.pcd.intensity && this.pcd.intensity.length > 0) {
            arr = this.pcd.intensity
          }
          break
        case 'x':
          arr = []
          this.pcd.position.forEach((value, index) => {
            if (index % 3 === 0) {
              arr.push(value)
            }
          })
          break
        case 'y':
          arr = []
          this.pcd.position.forEach((value, index) => {
            if (index % 3 === 1) {
              arr.push(value)
            }
          })
          break
        case 'z':
          arr = []
          this.pcd.position.forEach((value, index) => {
            if (index % 3 === 2) {
              arr.push(value)
            }
          })
          break
      }
      if (arr) {
        const [range_min, range_max] = pcUserSettings.value.setting.colorPointsSetting.range
        const colorMap = pcUserSettings.value.setting.colorPointsSetting.colorMap
        colorArr = await calcPointCloudColor(arr, range_min, range_max, colorMap)
      }
    } else if (pcUserSettings.value.setting.colorPoints === 'RGB') {
      if (this.pcd.rgb && this.pcd.rgb.length > 0) {
        colorArr = this.pcd.rgb
      } 
    } else {
      const color = [] as number[]
      color.length = this.pcd.position.length
      color.fill(pcUserSettings.value.setting.pointBrightness)
      colorArr = color
    }

    // 兜底:选了 RGB/颜色映射但点云没有对应数据(如 LAS point format 1 无
    // RGB)时,colorArr 会是空数组,长度为 0 的 color attribute 在 WebGL 里
    // 取默认值 (0,0,0),整朵云渲染成黑色、暗色主题下等于不可见。退回单色。
    if (colorArr.length < this.pcd.position.length) {
      colorArr = new Array<number>(this.pcd.position.length)
      colorArr.fill(pcUserSettings.value.setting.pointBrightness)
    }

    // step 2 color by label
    this.colorArr = colorArr
    this.colorByLabels()
    this.updateColor()

    eventBus.emit(eventBus.pcEditor.Gl.Updated)
  }
}

class GlLidars {
  private glLidars
  constructor() {
    this.glLidars = new Map<string, GlPointcloud>()
  }

  public getCurrentMesh(): THREE.Points {
    const glLidar = this.glLidars.get(glGlobals.buildPcdMeshName(jobConfig))
    return glLidar?.pcdMesh
  }

  public getCurrent(options:any): GlPointcloud {
    return this.glLidars.get(glGlobals.buildPcdMeshName(options))
  }

  public async buildGl(options:any): Promise<GlPointcloud> {
    const {stream, ts, frame} = options
    const glLidar = this.glLidars.get(glGlobals.buildPcdMeshName(options))
    if (glLidar) {
      
      eventBus.emit(eventBus.PointCloud.MeshBuilded)
      return glLidar
    } else {
      const pointsObject = await pySeqData.loadPcd({ ...jobConfig, streamId:stream, ts })
      const glLidar = new GlPointcloud(pointsObject, stream, ts, frame)
      glLidar.fitCameraToCloud()
      glLidar.colorPoints()
      this.glLidars.set(glGlobals.buildPcdMeshName(options), glLidar)

      eventBus.emit(eventBus.PointCloud.MeshBuilded)
      return glLidar
    }
  }
}

const glPcs = new GlLidars()
eventBus.on(eventBus.SeqData.FrameChanged, async (params) => {
  const { streamId, ts } = params
  const glPc = await glPcs.buildGl({ ...jobConfig, stream:streamId, ts })
  // glPc.pcdMesh.layers.set(glObjectState.layers.pc.id)
})
eventBus.on(eventBus.pcEditor.Inited, () => {
  watch(
    [
      () => pcUserSettings.value.setting.colorPoints,
      () => pcUserSettings.value.setting.pointBrightness,
      () => pcUserSettings.value.setting.colorPointsSetting.range,
      () => pcUserSettings.value.setting.colorPointsSetting.colorMap,
      () => pcUserSettings.value.setting.colorPointsSetting.field
    ],
    (newValue, oldValue) => {
      if (newValue !== oldValue) {
        glPcs.buildGl(jobConfig).then((glLidar) => {
          glLidar.colorPoints()
        })
      }
    }
  )

  watch(
    [
      () => pcUserSettings.value.setting.pointSize, 
    ],
    (newValue, oldValue) => {
      if (newValue !== oldValue) {
        glPcs.buildGl(jobConfig).then((glLidar) => {
          glLidar.updatePointsSize()
        })
      }
    }
  )
})

/**
 * update selected points color
 */
eventBus.on(eventBus.PointCloud.SelectedChanged, (params) => {
  const {selected} = params
  glPcs.getCurrent(jobConfig)?.setSelectedPoints(selected)
})
/**
 * update points color
 */
eventBus.on(eventBus.PointCloud.LabelToPointsChanged, (params: 
  { label: string; points: number[]; pointColor: number[] }[]) => {
  glPcs.getCurrent(jobConfig)?.updateLabelsPoints(params)
})

eventBus.on(eventBus.PointCloud.UpdatePointVisible, (params: 
  { points: number[]; visible: boolean }) => {
  glPcs.getCurrent(jobConfig)?.updatePointVisible(params)
})

watch(
  [() => glObjectState.viewsInited, () => glObjectState.layers.pc.visible],
  (newValue, oldValue) => {
    if (!newValue[0]) return
    if (newValue[1]) {
      glGlobals.mainView.camera.layers.enable(glObjectState.layers.pc.id)
    } else {
      glGlobals.mainView.camera.layers.disable(glObjectState.layers.pc.id)
    }
  },
  { immediate: true }
)

export { glPcs }