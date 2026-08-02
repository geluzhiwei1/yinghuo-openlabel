import { createGlobalState, useStorage  } from '@vueuse/core'
import { ref, computed } from 'vue'
import _ from 'lodash'
import { jobConfig } from '@/states/job-config'

export const useDataState = createGlobalState(() => {
    const seq_meta = ref(new Map())
    const stream_meta = ref(new Map())
  
    // actions
    function update_seq_meta(id: string, meta: {}) {
      seq_meta.value.set(id, meta)
    }
    function update_stream_meta(id: string, meta: {}) {
      stream_meta.value.set(id, meta)
    }
  
    async function getCurrentSeqMetaAsync() {
      const seq_id = jobConfig.seq
      if (!seq_meta.value.has(seq_id)) {
        // 加载数据
        const params = { seq: seq_id }
        const res = await getDataSeqMeta(params)
        if (res) {
          update_seq_meta(seq_id, res)
        }
      }
      return seq_meta.value.get(seq_id)
    }
  
  function getCurrentSeqMeta() {
    const seq_id = jobConfig.seq
    if (!seq_meta.value.has(seq_id)) {
      return null
    }
    return seq_meta.value.get(seq_id)
  }
  
    async function getStreamMetaAsync(seq: string, stream: string) {
      const stream_key = `${seq}_${stream}`
      if (!stream_meta.value.has(stream_key)) {
        // 加载数据
        const params = { seq, stream }
        const res = await getStreamMeta(params)
        if (res) {
          update_stream_meta(stream_key, res)
        }
      }
      return stream_meta.value.get(stream_key)
    }
  
    function getStreamMetaSync(seq: string, stream: string) {
      const stream_key = `${seq}_${stream}`
      return stream_meta.value.get(stream_key)
    }
  
  function getCameras(seq_id:string | null = null):Array<any> {
    if (_.isEmpty(seq_id)) {
      seq_id = jobConfig.seq
    }
    const seqMeta = seq_meta.value.get(seq_id)
      const cams: any[] = []
      _.forIn(seqMeta.openlabel.streams, (streamObj, key) => {
        if (streamObj.type === 'camera') {
          cams.push({
            camera_id: key,
            camera_type: streamObj.type,
            group_name: _.get(streamObj, 'stream_properties.group.name', ''),
            group_value: _.get(streamObj, 'stream_properties.group.value', ''),
            camera_resolution: `${_.get(
              streamObj,
              'stream_properties.intrinsics_pinhole.width_px',
              ''
            )} x ${_.get(streamObj, 'stream_properties.intrinsics_pinhole.height_px', '')}`,
            checked: false
          })
        }
      })
    
    return cams
    }
  
    async function getCurrentStreamMeta() {
      // const stream_key = `${jobConfig.seq}_${jobConfig.stream}`
      return getStreamMetaAsync(jobConfig.seq, jobConfig.stream)
    }
  
    // 确保数据已经加载
    const currentStreamMeta = computed(() => {
      const stream_key = `${jobConfig.seq}_${jobConfig.stream}`
      console.assert(stream_meta.value.has(stream_key), 'data is null')
      return stream_meta.value.get(stream_key)
    })
    const currentMeta = computed(() => {
      return getCurrentSeqMeta()
    })
  
    return {
      getCameras,
      getCurrentSeqMeta,
      getCurrentSeqMetaAsync,
      getStreamMetaSync,
      getStreamMetaAsync,
      currentMeta,
      currentStreamMeta,
      getCurrentStreamMeta,
      seq_meta
    }
})