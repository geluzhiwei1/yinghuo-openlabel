import { eventBus } from './event/EventBus'
import { PCDLoader } from '@/libs/threejs/YhPCDLoader.js'
import { PLYLoader } from '@/libs/threejs/YhPLYLoader.js'
import { LASLoader } from '@/libs/threejs/YhLASLoader.js'
import { reqJson } from '@/api/req'
import { watch } from 'vue'
import { jobConfig } from '@/states/job-config'
import { dataSeqState } from '@/states/DataSeqState'
import _ from 'lodash'
import { PCDLoader as glPCDLoader } from '@loaders.gl/pcd';
import { load as glLoad, parse as glParse} from '@loaders.gl/core';
import type { PCDFormat } from '@/types/data-format'
import { userAuth } from '@/states/UserState'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'
import { pathBlobMap } from '@/states/LocalFiles'
import { fileAPi } from '@/api'
import { ensureRustWasm } from '@/libs/plugin'
import { sanitizePointcloud } from './utils/sanitize'

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
    loadPcd: async (data:object): Promise<PCDFormat> => {
        return pySeqData.loadPointCloud(data)
    },
    /**
     * 通用点云加载入口,按 URI 后缀分发到对应 loader。
     * 保留 loadPcd 作为别名,gl-pcs.ts:298 等历史调用方不需要改。
     *
     * 各 loader 内部调 rust_wasm 解析,返回 {header, position, normal, color,
     * intensity, label, rgb} 同样的形状。
     */
    loadPointCloud: async (data:object): Promise<PCDFormat> => {
        const loading = ElLoading.service({
            lock: true,
            text: '加载点云数据...',
            background: 'rgba(0, 0, 0, 0.7)',
        })

        let uri = undefined
        if (dataSeqState.streamMeta.openlabel) {
            uri = dataSeqState.streamMeta.openlabel.frames[jobConfig.frame].frame_properties.uri
        }

        let uri_full = `${uri}?token=${userAuth.value.access_token}&uuid=${jobConfig.uuid}`
        // 是否本地文件
        if (jobConfig.data_source === 'localImage') {
            if (!pathBlobMap.has(uri)) {
                ElMessage.warning('找不到文件: ' + uri + ', 请刷新页面重新加载数据!')
            }
            uri_full = URL.createObjectURL(pathBlobMap.get(uri))
        } else {
            const queryParams = new URLSearchParams({
                token: userAuth.value.access_token,
                uuid: jobConfig.uuid,
                frame: data.frame.toString(),
                stream: data.stream.toString()
              })
            uri_full = `${fileAPi.uri2}?${queryParams.toString()}`;
        }

        // 按后缀分发。本地文件用 blob: URL 时,从原始 uri 取后缀。
        const ext = (uri || uri_full).split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || 'pcd'
        type PcLoader = Pick<PCDLoader, 'load'>
        let loader: PcLoader
        if (ext === 'pcd')        loader = new PCDLoader()
        else if (ext === 'ply')   loader = new PLYLoader()
        else if (ext === 'las')   loader = new LASLoader(undefined, 'las')
        else if (ext === 'laz')   loader = new LASLoader(undefined, 'laz')
        else throw new Error(`不支持的点云格式: .${ext}(支持 pcd/ply/las/laz)`)

        // pcd 有 JS fallback 可以不依赖 wasm;ply/las/laz 只有 wasm 解析路径
        if (ext !== 'pcd') {
            await ensureRustWasm().catch((err) => {
                loading.close()
                throw err
            })
        }

        return new Promise<PCDFormat>((resolve, reject) => {
            loader.load(uri_full, (pointsObject: PCDFormat) => {
                const { pc, dropped } = sanitizePointcloud(pointsObject)
                if (dropped > 0) {
                    console.warn(`[loadPointCloud] 剔除 ${dropped} 个无效点(NaN/Inf坐标), 剩余 ${pc.position.length / 3} 个点`)
                    if (pc.position.length === 0) {
                        ElMessage.error('点云文件所有点均为无效坐标(NaN), 无法渲染')
                    } else {
                        ElMessage.warning(`点云含 ${dropped} 个无效点(NaN/Inf), 已剔除`)
                    }
                }
                resolve(pc)
                loading.close()
            }, ( xhr )=>{console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );},
            (error) => {
                reject(error)
                loading.close()
            })
        })
    },
    load_pcd_http_gl: async (data:object) => {
        const url = import.meta.env.BASE_URL + '/000004.pcd'
        return new Promise((resolve, reject) => {
            glParse(fetch(url), glPCDLoader, {}).then(res => {
                resolve(res)
            }).catch(err => {
                reject(err)
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
    seq_sort_camera_by_point: async (data:object) => {
        return reqJson({ uri: bizBaseURL + '/algo/seq_sort_camera_by_point', method: 'POST', data})
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

    if (jobConfig.data_format === 'openlabel') {
        await pySeqData.get_pose_({
            ...jobConfig,
            ...params,
        })
    }

    // 数据加载完了，再发信号
    jobConfig.ts = params.ts
    eventBus.emitAsync(eventBus.SeqData.FrameChanged, {
      streamId:jobConfig.stream, ts:params.ts, frame: jobConfig.frame
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
            const url = new URL(window.location.href)
            const coordinate_system = url.searchParams.get('coordinate_system') || ""

            jobConfig.seq = jobConfig.seq
            jobConfig.stream = jobConfig.stream
            jobConfig.coordinate_system = coordinate_system
            jobConfig.mission = jobConfig.mission
            // 发布变化事件
            const ts = parseFloat(_.get(
              dataSeqState.streamMeta,
              `openlabel.frames.${newVal}.frame_properties.timestamp`,
              '-1'
            ))
            jobConfig.ts = ts
            if (ts < 0) {
                jobConfig.ts = 0
            }
            eventBus.emit(eventBus.SeqData.FrameChanging, {
              stream:jobConfig.stream, ts:jobConfig.ts, frame:jobConfig.frame
            })
        },{immediate:true})
  })