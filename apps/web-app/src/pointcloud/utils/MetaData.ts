import _, { get } from 'lodash'
import * as THREE from 'three'
import { pySeqData } from '../api'
import { jobConfig } from '@/states/job-config'


/**
 * 读帧的位置，返回THREE.Matrix4
 * @param meta meta object
 * @returns Matrix4
 */
const getFramePosition = (meta: object, ts: number): THREE.Matrix4 => {
    const matrix = new THREE.Matrix4().identity()
    const arr = pySeqData.get_pose({ts:ts})
    if (!arr || arr.length !== 7) {
        return matrix
    }
    matrix.compose(new THREE.Vector3(arr[0], arr[1], arr[2]),
        new THREE.Quaternion(arr[4], arr[5], arr[6], arr[3]), new THREE.Vector3(1, 1, 1))
    return matrix
}

const getExtrinsics = (sensor:string) => {
    const path = `openlabel.coordinate_systems.${sensor}.pose_wrt_parent.matrix4x4`
    const seqMeta = pySeqData.get_seq_meta2()
    return get(seqMeta, path)
}


// /**
//  * 获取sensor外参
//  * @param meta 
//  * @param sensorId 
//  * @returns number[] 长度16
//  */
// const getExtrinsicsSensorInEgo = (meta: object, sensorId: string): number[] => {
//     const path = `openlabel.coordinate_systems.${sensorId}.pose_wrt_parent.matrix4x4`
//     return _.get(meta, path)
// }

// /**
//  * 获取sensor外参
//  * @param meta 
//  * @param sensorId 
//  * @returns number[] 长度16
//  */
// const getExtrinsicsEgoInSensor = (meta: object, sensorId: string): number[] => {
//     const path = `openlabel.coordinate_systems.${sensorId}.pose_wrt_parent.matrix4x4`
//     const arr = _.get(meta, path)
//     const matrix = new THREE.Matrix4().set(...arr)
//     return matrix.invert().elements
// }

export { getFramePosition, getExtrinsics}