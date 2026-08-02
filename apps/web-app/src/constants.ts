export enum Mission {
    ObjectBBox2d = 'objectBBox2d',
    ObjectRBBox2d = 'objectRBBox2d',
    TrafficSignal2d = 'trafficSignal2d',
    TrafficSign2d = 'trafficSign2d',
    TrafficLine2d = 'trafficLine2d',
    ParkingSlot2d = 'parkingSlot2d',
    Semantic2d = 'semantic2d',

    // video
    VideoEvents = 'videoEvents',

    // 3d
    ObjectBBox3d = 'objectBBox3d',
    PcSemantic3d = 'pcSemantic3d',
    PcPolyline3d = 'pcPolyline3d'
}

export enum LabelOpType {
    Create = 'create',
    Update = 'update',
    Remove = 'remove',

    //
    Undo = 'undo',
    Redo = 'redo'
}

export const AnnoMissons = [
    {
        value: '2D',
        label: '2D图像任务',
        children: [
            { value: 'objectBBox2d', label: '2D框-Bounding Box' },
            { value: 'objectRBBox2d', label: '2D旋转框-Rotated Bounding Box' },
            { value: 'semantic2d', label: '语义分割' },
            // { value: 'trafficLine2d', label: '交通标线' },
            // { value: 'parkingSlot2d', label: '停车场/车位' },
            // { value: 'trafficSignal2d', label: '信号灯' },
            // { value: 'trafficSign2d', label: '交通标识' },
        ]
    },
    {
        value: 'Video',
        label: '视频标注',
        children: [
            { value: 'videoEvents', label: '视频事件' },
        ]
    },
    {
        value: '3D',
        label: '3D点云任务',
        children: [
            { value: 'objectBBox3d', label: '3D框-Bounding Box' },
            { value: 'pcPolyline3d', label: '3D曲线标注' },
            { value: 'pcSemantic3d', label: '语义分割' },
        ]
    }
]

export const JobStatus = [
    { label: "待标注", value: "待标注" },
    { label: "标注中", value: "标注中" },
    { label: "待审核", value: "待审核" },
    { label: "待修正", value: "待修正" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" },
    { label: "已锁定", value: "已锁定" },
]