import { computed } from 'vue'
import { globalStates } from '@/states'


export const formatTooltipContent = (tool) => {
  return tool.name + '</br>' + tool.description + '</br>快捷键：' + tool.shortcut
}

export const toolButtonClick = (btnId: string) => {
  if (btnId !== globalStates.subTool) {
    globalStates.subTool = btnId
  } else {
    globalStates.subTool = ''
  }
}
