import { type Menus } from '@/types/menu';

// TODO 后台接口获取
export const menuData: Menus[] = [
    {
        id: '0v2',
        title: '首页',
        icon: 'material-symbols:dashboard-outline',
        index: '/dashboard-v2',
    },
    {
        id: '2v2',
        title: '标注任务',
        icon: 'material-symbols:draw-outline',
        index: '/annojob-v2',
        role: 'annojob-v2',
    },
    {
        id: '4',
        title: '标注管理',
        index: '4',
        icon: 'material-symbols:description-outline',
        children: [
            {
                id: '41',
                pid: '1',
                index: '/my-job',
                role: 'my-job',
                title: '我的任务'
            },
            {
                id: '43',
                pid: '1',
                index: '/anno-specification',
                role: 'anno-specification',
                title: '标注规范'
            },
            {
                id: '42',
                pid: '1',
                index: '/data-package-manager',
                role: 'data-package-manager',
                title: '数据包管理'
            },
            {
                id: '45',
                pid: '1',
                index: '/label-batch',
                role: 'label-batch',
                title: '标注批次'
            },
            {
                // Stage 9.6: workflow 驱动的批次管理
                id: '46',
                pid: '1',
                index: '/batches',
                role: 'batches-list',
                title: '批次管理',
                permiss: 'business:anno-job:read',
            },
            {
                // Stage 10.2: 工作流运行态监控
                id: '47',
                pid: '1',
                index: '/workflow-monitor',
                role: 'workflow-monitor',
                title: '工作流监控',
                permiss: 'business:workflow:read',
            },
        ]
    },
    {
        id: '3',
        title: '团队信息',
        index: '3',
        icon: 'material-symbols:groups-outline',
        children: [
            {
                id: '32',
                pid: '1',
                index: '/my-group',
                role: 'my-group',
                title: '我的团队'
            },
            {
                id: '31',
                pid: '1',
                index: '/other-group',
                role: 'other-group',
                title: '我参加的'
            },
        ]
    },
    {
        id: '5',
        title: '系统数据',
        index: '5',
        icon: 'material-symbols:database-outline',
        children: [
            {
                id: '10',
                pid: '1',
                index: '/system-dept',
                role: 'system-dept',
                title: '部门管理',
            },
            {
                id: '12',
                pid: '1',
                index: '/system-role',
                role: 'system-role',
                title: '角色管理',
            },
            {
                id: '14',
                pid: '1',
                index: '/system-data',
                role: 'system-data',
                title: '我的数据',
            },
        ]
    },
    {
        id: '1',
        title: '系统设置',
        index: '2',
        icon: 'material-symbols:settings-outline',
        children: [
            {
                id: '11',
                pid: '1',
                index: '/user-info',
                role: 'user-info',
                title: '我的信息',
            },
            {
                id: '13',
                pid: '1',
                index: '/system-menu',
                title: '菜单管理',
            },
        ],
    },
    
];
