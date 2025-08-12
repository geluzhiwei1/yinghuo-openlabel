export const semanticButtons = {
  "polygonTool":{
    id: 'polygonTool',
    icon: 'lucide:pen-line',
    name: '分割',
    shortcut: '',
    description: '<el-text>单击鼠标左键开始，单击鼠标右键完成</el-text>',
    showButton: false,
  },
  "segmentByRectTool":{
    id: 'segmentByRectTool',
    icon: 'iconoir:3d-rect-three-pts',
    name: '拉框分割',
    shortcut: '左击 + 左击',
    description: '<el-text>单击鼠标左键开始</el-text>',
    showButton: false,
  }
}


export const imageButtons = [
  {
    id: 'image-reset',
    icon: 'ix:hard-reset',
    name: '恢复图像',
    shortcut: '',
    description: '<el-text>恢复至默认大小、默认颜色</el-text>',
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-reset' })
    }
  },]

export const naviButtons = [
  {
    id: 'image-first',
    icon: 'uis:previous',
    name: '第一个',
    shortcut: '',
    description: '<el-text>跳到第一个</el-text>',
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-first' })
    }
  },
  {
    id: 'image-previous',
    icon: 'uis:angle-left',
    name: '上一个',
    shortcut: 'R',
    description: '<el-text>跳到上一个</el-text>',
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-previous' })
    }
  },
  {
    id: 'image-next',
    icon: 'uis:angle-right',
    name: '下一个',
    shortcut: 'F',
    description: '<el-text>跳到下一个</el-text>',
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-next' })
    }
  },
  {
    id: 'image-last',
    icon: 'uis:step-forward',
    name: '最后',
    shortcut: '',
    description: '<el-text>跳到最后</el-text>',
    showButton: true,
    handle: () => {
      // commonChannel.pub(commonChannel.Events.ButtonClicked, { data: 'image-last' })
    }
  }
]
