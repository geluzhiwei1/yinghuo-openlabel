<template>
  <el-tooltip v-if="toolVisible" placement="bottom-start" raw-content :content="formatTooltipContent(toolBarConf)">
    <el-button type="primary" :style="toolBarConf.style" @click="toolButtonClick(toolBarConf.id)">
      <el-popover placement="bottom" :width="600" :visible="settingVisible" :auto-close="0">
        <template #reference>
          <Icon :icon="toolBarConf.icon" />
        </template>
        <div>
          <el-tabs v-model="activePane">
            <el-tab-pane label="样式" name="commonTool">
              <VueForm id="propertyForm" ref="propertyForm" label-width="auto"
                :formProps="{ labelPosition: 'right', layoutColumn: 2 }" v-model="settingUIForm.formData1"
                :schema="settingUISchema.schema" :formFooter="{ show: false }" />
            </el-tab-pane>
            <el-tab-pane label="显示" name="commonUi">
              <VueForm size="small" label-width="auto" v-model="commonAnnotaterSetting.settingFormData"
                :schema="commonUi.schema" :formProps="{ labelPosition: 'left', layoutColumn: 1 }"
                :formFooter="{ show: false }" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-popover>
    </el-button>
  </el-tooltip>
  <Teleport to="#imageAnnoContainer">
    <div v-show="hotBarOptions.visible" :style="[hotBarOptions.style]" style="z-index: 99;">
      <el-button-group>
        <el-tooltip placement="top" effect="dark" raw-content content="拷贝本对象到上一帧">
          <el-button round size="small" type="primary" @click="hotbtnClick('copyToLast', {})">
            &lt;拷贝
          </el-button>
        </el-tooltip>
        <el-tooltip placement="top" effect="dark" raw-content content="拷贝本对象到下一帧">
          <el-button round size="small" type="primary" @click="hotbtnClick('copyToNext', {})">
            拷贝&gt;
          </el-button>
        </el-tooltip>
        <el-tooltip placement="top" effect="dark" raw-content content="删除选中的对象">
          <el-button round size="small" type="primary" @click="hotbtnClick('remove', {})">
            删除
          </el-button>
        </el-tooltip>
        <el-dropdown @command="handleCommand">
          <el-button size="small" type="primary">
            ...
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="interpolate">插值</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-button-group>
    </div>
  </Teleport>
</template>
<script lang="tsx" setup>
import { ref, watch } from 'vue'
import { globalStates } from '@/states'
import { formatTooltipContent, toolButtonClick } from './utils'
import { ElTag, ElButton, ElTooltip, ElPopover, ElForm, ElFormItem, ElCol, ElRow, ElNotification } from 'element-plus'
import VueForm from '@lljj/vue3-form-element'
import { Icon } from '@iconify/vue'
import { toolBarConf, settingUIForm, settingUISchema, hotBarOptions, BBoxAnnotater } from '../bboxAnnotater'
import { commonAnnotaterSetting, settingUISchema as commonUi } from '../common-annotater-settings'
import { InpterpolateObject, toolStates as interpolateObjectStates } from '../../../tools/inpterpolate-object'
import { jobConfig } from '@/states/job-config'

const activePane = ref('commonUi')
const settingOptionsVisible = ref(false)
const toolVisible = ref(true)
const settingVisible = ref(false)

watch(() => globalStates.subTool, (newValue, oldValue) => {
  if (toolBarConf.id === newValue) {
    settingVisible.value = true
  } else {
    settingVisible.value = false
  }
})

const inpterClick = () => {
  const obj = {
    ...globalStates.mainAnnoater.getSelectedObject().userData.anno
  }
  delete obj.attributes.__oldObj
  InpterpolateObject.instance().addGeometryAndActivate(obj, jobConfig.frame)
}

const handleCommand = (command: string | number | object) => {
  switch (command) {
    case 'interpolate':
      inpterClick()
      break
    default:
      break
  }
}

const hotbtnClick = (cmd: string, data) => {
  switch (cmd) {
    case 'copyToLast':
    case 'copyToNext':
      BBoxAnnotater.instance.copyTo(cmd)
      break
    case 'remove':
      globalStates.mainAnnoater.removeSelected()
      break
    default:
      break
  }
}

</script>