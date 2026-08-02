import { eventBus } from './event-bus'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { reqJson } from '@/api/req'
import { watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import _ from 'lodash'
import { useDataState } from './store'

const { current_seq, currentMeta } = useDataState()


export const loadSeqMeta = async (seqId:string) => {
    const seq_id = seqId
    const http_server = 'http://192.168.3.187:3923/'
    const tk = ''
    // const pySeqData = await window.pyUtils.SeqData.from_web_in_browser(seq_id, http_server, tk)

    eventBus.emit(eventBus.SeqData.Loaded)
}

eventBus.on(eventBus.SeqData.SeqIdChanged, (seqId:string) => {
    loadSeqMeta(seqId)
})

const bizBaseURL = "/api/v1/b"
const seqDataPoseCache = new Map<number, any>() // ts, pose_array
let seqMeta:any = null
export const pySeqData = {
    get_pose: (data:object) => {
        const { ts } = data
        return seqDataPoseCache.get(ts)
    },
    get_pose_: async (data:object) => {
        const { stream, ts } = data
        const res = await reqJson({ uri: bizBaseURL + '/algo/seq_get_pose', method: 'POST', data})
        seqDataPoseCache.set(ts, res.data)
    },
    parse_pcd: async (data:object) => {
        return reqJson({ uri: bizBaseURL + '/algo/seq_parse_pcd', method: 'POST', data})
    },
    load_pcd_http: async (data:object) => {
        const loader = new PCDLoader()
        const url = '/000004.pcd'
        return new Promise((resolve, reject) => {
            loader.load(url, (points) => {
                const position = points.geometry.getAttribute('position')
                const rgb = []
                resolve({position, rgb})
            }, ( xhr )=>{console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );},
            (error) => {
                reject(error)
            })
        })
    },
    get_seq_meta: async (data:object) => {
        if (seqMeta) {
            return seqMeta
        }
        const res = await reqJson({ uri: bizBaseURL + '/algo/seq_get_seq_meta', method: 'POST', data})
        seqMeta = res.data
        return seqMeta
    },
    get_seq_meta2: () => {
        return seqMeta
    },
    get_frame_uris: async (data:object) => {
        return reqJson({ uri: bizBaseURL + '/algo/seq_get_frame_uris', method: 'POST', data})
    },
    annotation: {
        load: async (data:object) => {
            return reqJson({ uri: bizBaseURL + '/algo/seq_load_annotation', method: 'POST', data})
        },
        calc_psr_box_from_Points: async (data:object) => {
            return reqJson({ uri: bizBaseURL + '/algo/seq_anno_calc_psr_box_from_points', method: 'POST', data})
        },
        select_by_rect: async (data:object) => {
            return reqJson({ uri: bizBaseURL + '/algo/seq_anno_select_by_rect', method: 'POST', data})
        }
    },
    visualizer: {
        plot_boxes_on_synced_image: async (data:object) => {
            return reqJson({ uri: bizBaseURL + '/algo/seq_visualizer_plot_boxes_on_synced_image', method: 'POST', data})
        }
    },
    PcUtils: {
        calc_color: async (data:object) => {
            return reqJson({ uri: bizBaseURL + '/algo/pc_utils_calc_color', method: 'POST', data})
        }
    }
}

/**
 * 想要改变帧，加载新帧的数据
 */
eventBus.on(eventBus.SeqData.FrameChanging, async (params) => {
    await pySeqData.get_pose_({
        ...jobConfig,
        ...params,
    })

    // 数据加载完了，再发信号
    current_seq.ts = params.ts
    eventBus.emit(eventBus.SeqData.FrameChanged, {
      streamId:'up_lidar', frameId:params.ts, ts:params.ts
    })
})

// eventBus.on(eventBus.SeqData.MetaLoaded, () => {
watch(() => dataSeqState.loaded, () => {
    watch(
        () => jobConfig.frame,
        (newVal) => {
            const img_uri = _.get(
                dataSeqState.streamMeta,
                `openlabel.frames.${newVal}.frame_properties.uri`,
                ''
            )
            // if ('' !== img_uri) {
            //     globalStates.current_data.image_uri = img_uri
            // }
            const url = new URL(window.location.href)
            const coordinate_system = url.searchParams.get('coordinate_system') || ""

            current_seq.seq = jobConfig.seq
            current_seq.stream = jobConfig.stream
            current_seq.coordinate_system = coordinate_system
            current_seq.mission = jobConfig.mission
            // 发布变化事件
            const ts = parseFloat(_.get(
              dataSeqState.streamMeta,
              `openlabel.frames.${newVal}.frame_properties.timestamp`,
              '0'
            ))
            eventBus.emit(eventBus.SeqData.FrameChanging, {
              stream:jobConfig.stream, ts:ts, streamId:jobConfig.stream
            })
        },{immediate:true})
  })