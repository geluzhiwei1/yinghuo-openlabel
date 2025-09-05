import home from '@/home/locales/zh-CN'
import video from '@/video/locales/zh-CN'
import auth from '@/login/locales/zh-CN'
import admin from '@/home/locales/zh-CN'

const pointcloud = {}

export default {
  app: {
    title: '萤火',
    description: '2D视觉数据标注工具',
    welcome: '欢迎使用'
  },
  'action.create': '创建',
  'action.edit': '编辑',
  jobManage: {
    title: '任务管理',
    toolbar: {
      create: '新建任务'
    }
  },
  components: {
    annoSpecSelector: {
      tooltip: '选择标签分类标准',
      systemSpec: '系统规范',
      mySpec: '我的规范',
      newSpec: '新建规范',
      select: '选择',
      name: '名称',
      code: '编码',
      category: '分类',
      version: '版本',
      language: '语言',
      reference: '参考',
      description: '说明',
      updatedTime: '更新时间',
      enabled: '是否启用',
      desc: '描述',
      loadSystemSpec: '刷新',
    },
    prioritySelect: {
      placeholder: '请选择优先级',
      lowest: '1-最低',
      medium: '3-中等',
      highest: '5-最高'
    },
    rolesSelect: {
      placeholder: '请选择角色'
    },
    tableCustom: {
      deleteSelection: '删除选中',
      refresh: '刷新',
      columnSettings: '列设置',
      view: '详情',
      edit: '编辑',
      delete: '删除',
      deleteConfirm: '确定要删除吗？',
      deleteTitle: '提示'
    },
    tableEdit: {
      save: '保存',
      required: '{label}不能为空'
    },
    tableSearch: {
      rangeSeparator: '至',
      startDate: '开始日期',
      endDate: '结束日期',
      search: '搜索',
      reset: '重置'
    },
    tabs: {
      options: '标签选项',
      refresh: '刷新',
      closeOther: '关闭其他',
      closeCurrent: '关闭当前',
      closeAll: '关闭所有'
    },
    teamMembersSelect: {
      placeholder: '请选择',
      noMembers: '请先添加团队成员'
    }
  },
  states: {
    dataSeqState: {
      alert: {
        title: '提示',
        message: '本任务数据在您的计算机上，请选择文件夹：{stream}。本操作不会上传数据文件。',
        confirmButtonText: '选择数据文件夹'
      },
      messages: {
        fileNotFound: '找不到文件: {fileExts}, 请重新选择',
        exception: '异常：{err}'
      }
    }
  },
  home,
  pointcloud,
  auth,
  admin,
  video
}
