import { reactive } from 'vue'
import { annoJobPerformApi } from '@/api'
import { ElMessageBox } from 'element-plus'

const initFromQuery = () => {
  const url = new URL(window.location.href)
  const uuid = url.searchParams.get('uuid') || ''
  // const seq = url.searchParams.get('seq') || ''
  const stream = url.searchParams.get('stream') || ''
  const frame = parseInt(url.searchParams.get('frame') || '0')
  const ts = parseInt(url.searchParams.get('ts') || '0')

  annoJobPerformApi.info({ uuid }).then((res) => {
    if (!res.data || !res.data[0]) {
      ElMessageBox.alert('任务不存在', 'error')
      return false
    }
    const j = res.data[0]
    jobConfig.uuid = uuid
    jobConfig.seq = j.label_spec.data.seq
    jobConfig.stream = stream
    jobConfig.frame = frame
    jobConfig.ts = ts
    // jobConfig.coordinate_system = coordinate_system
    jobConfig.mission = j.label_spec.mission.key || ''
    jobConfig.domain = j.label_spec.domain.key || ''
    jobConfig.data_format = j.label_spec.data.format || ''
    jobConfig.data_source = j.label_spec.data.dataSource || ''
    jobConfig.taxonomy = j.label_spec.taxonomy || {}

    jobConfig.inited = true
  })

  return true
}

const jobConfig = reactive({
  data_format: 'simple-directory',
  data_source: '',
  seq: '',
  stream: '',
  /**
   * frame序号
   */
  frame: 0,
  coordinate_system: '',

  domain: '',
  mission: '',
  taxonomy: {},
  uuid: '',
  /** frame 时间戳 */
  ts: 0,
  inited: false
})

export { initFromQuery, jobConfig }
