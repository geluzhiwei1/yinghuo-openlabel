import { reactive } from "vue"
import ColorPickerWidget from '@/components/form/ColorPickerWidget.vue'
import { set, clone } from 'radash'
import { useStorage } from '@vueuse/core'

const defaultSettingFormData = {
    settings: {
      hideAllLabels: false,
      autoHideLabels: false,
      hideToolSettings: false,
      hideHelperLines: false
    },
  }

export const settingUISchema = {
    schema: {
      type: 'object',
      required: [],
      'ui:order': ['*'],
      properties: {
        settings: {
          type: 'object',
          properties: {
            hideAllLabels: {
              title: '隐藏所有标签',
              description: '隐藏当前帧所有标签',
              default: defaultSettingFormData.settings.hideAllLabels,
              type: 'boolean'
            },
            autoHideLabels: {
              title: '自动隐藏标签',
              description: '当使用工具栏时，自动隐藏其他框的标签',
              default: defaultSettingFormData.settings.autoHideLabels,
              type: 'boolean'
            },
            hideToolSettings: {
              title: '隐藏工具属性窗口',
              description: '当启用工具时，不显示工具的属性设置窗口',
              default: defaultSettingFormData.settings.hideToolSettings,
              type: 'boolean'
            },
            hideHelperLines: {
              title: '隐藏辅助线',
              description: '当勾画目标时，不显示辅助线',
              default: defaultSettingFormData.settings.hideHelperLines,
              type: 'boolean'
            }
          }
        },
      }
    }
}

export const commonAnnotaterSetting = useStorage('yh-anno-comm-setting', {
settingFormData: {
    ...clone(defaultSettingFormData)
}
}, sessionStorage)